import env from '#start/env'
import Payment from '#models/payment'
import Customer from '#models/customer'
import Subscription from '#models/subscription'
import { DateTime } from 'luxon'
import Stripe from 'stripe'
import logger from '@adonisjs/core/services/logger'
import { StripeService as PackageStripeService } from 'adonis-stripe-package'

const stripeSdk = new PackageStripeService(env.get('STRIPE_SECRET_KEY'), {
    apiVersion: env.get('STRIPE_API_VERSION', '2023-10-16') as any,
})

const ACTIVE_BLOCKING_STATUSES = new Set([
    'active',
    'trialing',
    'past_due',
    'incomplete',
    'cancel_at_period_end',
])

const LIFETIME_PRICE_ID = process.env.PRICE_LIFETIME
const CHECKOUT_SESSION_REUSE_WINDOW_SECONDS = 30 * 60
const CHECKOUT_IDEMPOTENCY_BUCKET_SECONDS = 5 * 60

export default class StripeService {
    // Simple in-memory cache to avoid repeated price fetches per process
    private priceCache = new Map<string, Stripe.Price>()

    private async getPrice(priceId: string) {
        const cached = this.priceCache.get(priceId)
        if (cached) return cached
        const price = await stripeSdk.retrievePrice(priceId)
        this.priceCache.set(priceId, price)
        return price
    }

    private mapSubscriptionStatus(sub: Stripe.Subscription) {
        if (sub.cancel_at_period_end && ['active', 'trialing'].includes(sub.status)) {
            return 'cancel_at_period_end'
        }

        return sub.status
    }

    private toDateTimeFromUnix(seconds: number | null | undefined) {
        return seconds ? DateTime.fromSeconds(seconds) : null
    }

    private async resolvePeriodEnd(
        priceId: string | null | undefined,
        periodEndUnix?: number | null,
        periodStartUnix?: number | null
    ) {
        // Use Stripe-provided period end when available
        const direct = this.toDateTimeFromUnix(periodEndUnix ?? undefined)
        if (direct) return direct

        if (!priceId) return null

        const price = await this.getPrice(priceId)

        if (!price.recurring) return null // lifetime / one-time

        const anchor = periodStartUnix ? DateTime.fromSeconds(periodStartUnix) : DateTime.now()

        const interval = price.recurring.interval
        const count = price.recurring.interval_count ?? 1

        return anchor.plus({ [interval]: count })
    }

    private async findReusableCheckoutSession(customerId: string, userId: number, priceId: string) {
        const sessions = await stripeSdk.listCheckoutSessions({
            customerId,
            limit: 20,
        })

        const nowUnix = Math.floor(Date.now() / 1000)

        return (
            sessions.data.find((session: Stripe.Checkout.Session) => {
                if (session.mode !== 'subscription') return false
                if (session.status !== 'open') return false
                if (!session.url) return false
                if (session.metadata?.userId !== String(userId)) return false
                if (session.metadata?.priceId !== priceId) return false
                return nowUnix - session.created <= CHECKOUT_SESSION_REUSE_WINDOW_SECONDS
            }) ?? null
        )
    }

    private async findReusableUpgradeSession(
        customerId: string,
        userId: number,
        priceId: string,
        oldSubscriptionId: string
    ) {
        const sessions = await stripeSdk.listCheckoutSessions({
            customerId,
            limit: 20,
        })

        const nowUnix = Math.floor(Date.now() / 1000)

        return (
            sessions.data.find((session: Stripe.Checkout.Session) => {
                if (session.mode !== 'subscription') return false
                if (session.status !== 'open') return false
                if (!session.url) return false
                if (session.metadata?.action !== 'upgrade') return false
                if (session.metadata?.userId !== String(userId)) return false
                if (session.metadata?.priceId !== priceId) return false
                if (session.metadata?.oldSubscriptionId !== oldSubscriptionId) return false
                return nowUnix - session.created <= CHECKOUT_SESSION_REUSE_WINDOW_SECONDS
            }) ?? null
        )
    }

    async createPaymentIntent(amount: number, currency: string, email?: string) {
        const paymentIntent = await stripeSdk.createPaymentIntent({
            amount,
            currency,
            metadata: { email: email ?? '' },
            automaticPaymentMethods: {
                enabled: true,
                allow_redirects: 'never',
            },
        })

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        }
    }

    async createPaymentIntentForPrice(priceId: string, email?: string) {
        const price = await stripeSdk.retrievePrice(priceId)

        if (!price.active) {
            throw new Error('Price is inactive')
        }

        if (price.recurring) {
            throw new Error('Use checkout for recurring prices')
        }

        const amount = price.unit_amount
        const currency = price.currency

        if (!amount || !currency) {
            throw new Error('Price missing amount or currency')
        }

        return this.createPaymentIntent(amount, currency, email)
    }

    async getPaymentIntentStatus(paymentIntentId: string) {
        const pi = await stripeSdk.retrievePaymentIntent(paymentIntentId)
        return {
            status: pi.status,
            amount: pi.amount,
            currency: pi.currency,
        }
    }

    async refundPayment(paymentIntentId: string, amount?: number) {
        const refund = await stripeSdk.createRefund({
            paymentIntentId,
            ...(amount ? { amount } : {}),
        })

        await Payment.query()
            .where('payment_intent_id', paymentIntentId)
            .update({ status: 'refunded' })

        return {
            refundId: refund.id,
            status: refund.status,
        }
    }

    async listPayments() {
        return Payment.query().orderBy('created_at', 'desc')
    }
    async createCustomer(email: string, userId: number, name?: string) {
        const customer = await stripeSdk.createCustomer({ email, name })

        await Customer.create({
            userId, // ← link to the seller
            stripeCustomerId: customer.id,
            email,
            name: name ?? null,
        })

        return {
            customerId: customer.id,
            email: customer.email,
        }
    }

    async createSubscription(customerId: string, priceId: string, userId: number) {
        const existingStripeSubs = await stripeSdk.listCustomerSubscriptions(customerId, 'all', 20)

        const activeLikeSub = existingStripeSubs.data.find((sub: Stripe.Subscription) => {
            const mapped = this.mapSubscriptionStatus(sub)
            return ACTIVE_BLOCKING_STATUSES.has(mapped)
        })

        if (activeLikeSub) {
            const err = new Error(
                'Customer already has an active or pending subscription'
            ) as Error & {
                code?: string
                details?: unknown
            }
            err.code = 'subscription_exists'
            err.details = {
                subscriptionId: activeLikeSub.id,
                status: this.mapSubscriptionStatus(activeLikeSub),
                planId: activeLikeSub.items.data[0]?.price?.id ?? null,
            }
            throw err
        }

        const subscription = await stripeSdk.createSubscription({
            customerId,
            items: [{ price: priceId }],
            paymentBehavior: 'default_incomplete',
            metadata: {
                userId: userId.toString(),
            },
        })

        const periodEnd = (subscription as any).current_period_end as number | undefined
        const mappedStatus = this.mapSubscriptionStatus(subscription)

        await Subscription.create({
            userId: userId,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customerId,
            planId: priceId,
            status: mappedStatus,
            currentPeriodEnd: await this.resolvePeriodEnd(
                priceId,
                periodEnd,
                (subscription as any).current_period_start as number | undefined
            ),
        })

        const invoice = subscription.latest_invoice as any
        const clientSecret = invoice?.payment_intent?.client_secret

        return {
            subscriptionId: subscription.id,
            clientSecret,
            status: mappedStatus,
        }
    }

    async cancelSubscription(subscriptionId: string, forceNow = false) {
        const existing = await stripeSdk.retrieveSubscription(subscriptionId)
        const priceId = existing.items.data[0]?.price?.id ?? null

        if (LIFETIME_PRICE_ID && priceId === LIFETIME_PRICE_ID) {
            const err = new Error('Lifetime plan cannot be canceled') as Error & { code?: string }
            err.code = 'lifetime_non_cancelable'
            throw err
        }

        if (forceNow) {
            const sub = await stripeSdk.cancelSubscription(subscriptionId)
            await Subscription.query()
                .where('stripe_subscription_id', subscriptionId)
                .update({
                    status: 'canceled',
                    current_period_end: await this.resolvePeriodEnd(
                        priceId,
                        (sub as any).current_period_end as number | undefined,
                        (sub as any).current_period_start as number | undefined
                    ),
                })
            return { status: sub.status }
        }

        const sub = await stripeSdk.updateSubscription(subscriptionId, {
            cancel_at_period_end: true,
        })

        const periodEnd = (sub as any).current_period_end as number | undefined

        await Subscription.query()
            .where('stripe_subscription_id', subscriptionId)
            .update({
                status: 'cancel_at_period_end',
                current_period_end: await this.resolvePeriodEnd(
                    priceId,
                    periodEnd,
                    (sub as any).current_period_start as number | undefined
                ),
            })

        return {
            status: 'cancel_at_period_end',
            cancelAt: periodEnd ? new Date(periodEnd * 1000) : null,
        }
    }

    async getSubscription(subscriptionId: string) {
        const sub = await stripeSdk.retrieveSubscription(subscriptionId)
        const subAny = sub as any
        const periodEnd = subAny.current_period_end as number | undefined

        return {
            id: sub.id,
            status: this.mapSubscriptionStatus(sub),
            currentPeriodEnd: this.toDateTimeFromUnix(periodEnd),
            planId: sub.items.data[0]?.price.id,
        }
    }

    constructWebhookEvent(rawBody: Buffer, signature: string, secret: string) {
        return stripeSdk.constructEvent(rawBody, signature, secret)
    }
    async handleWebhookEvent(event: Stripe.Event) {
        const baseMeta = { eventId: event.id, eventType: event.type }

        try {
            switch (event.type) {
                // ── Payment intent succeeded → save to payments table ──────────
                case 'payment_intent.succeeded': {
                    const pi = event.data.object as Stripe.PaymentIntent
                    logger.info('stripe:payment_intent.succeeded', {
                        ...baseMeta,
                        paymentIntentId: pi.id,
                        amount: pi.amount,
                    })
                    await Payment.updateOrCreate(
                        { paymentIntentId: pi.id },
                        {
                            paymentIntentId: pi.id,
                            customerEmail: pi.metadata?.email || null,
                            amount: pi.amount,
                            currency: pi.currency,
                            status: 'succeeded',
                        }
                    )
                    break
                }

                case 'payment_intent.payment_failed': {
                    const pi = event.data.object as Stripe.PaymentIntent
                    logger.warn('stripe:payment_intent.payment_failed', {
                        ...baseMeta,
                        paymentIntentId: pi.id,
                        amount: pi.amount,
                    })
                    await Payment.updateOrCreate(
                        { paymentIntentId: pi.id },
                        {
                            paymentIntentId: pi.id,
                            customerEmail: pi.metadata?.email || null,
                            amount: pi.amount,
                            currency: pi.currency,
                            status: 'failed',
                        }
                    )
                    break
                }

                // ── Charge succeeded → also save to payments table ─────────────
                // This fires for every successful charge (subscriptions, one-time)
                case 'charge.succeeded': {
                    const charge = event.data.object as Stripe.Charge
                    logger.info('stripe:charge.succeeded', {
                        ...baseMeta,
                        chargeId: charge.id,
                        paymentIntentId: charge.payment_intent ?? null,
                        amount: charge.amount,
                    })

                    // Only store if it has a payment intent (ignore setup charges)
                    if (!charge.payment_intent) break

                    await Payment.updateOrCreate(
                        { paymentIntentId: charge.payment_intent as string },
                        {
                            paymentIntentId: charge.payment_intent as string,
                            customerEmail: charge.billing_details?.email || null,
                            amount: charge.amount,
                            currency: charge.currency,
                            status: 'succeeded',
                        }
                    )
                    break
                }

                // ── Checkout session completed → PRIMARY source of truth ───────
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session
                    logger.info('stripe:checkout.session.completed', {
                        ...baseMeta,
                        sessionId: session.id,
                        subscriptionId:
                            typeof session.subscription === 'string' ? session.subscription : null,
                        priceId: session.metadata?.priceId ?? null,
                    })

                    const subscriptionId =
                        typeof session.subscription === 'string' ? session.subscription : null

                    // Subscription (recurring) path
                    if (subscriptionId) {
                        const freshSub = await stripeSdk.retrieveSubscription(subscriptionId)
                        const customerId =
                            typeof freshSub.customer === 'string'
                                ? freshSub.customer
                                : freshSub.customer.id
                        const customer = await Customer.findBy('stripe_customer_id', customerId)
                        const periodEnd = (freshSub as any).current_period_end as number | undefined
                        const mappedStatus = this.mapSubscriptionStatus(freshSub)

                        const action = session.metadata?.action

                        if (action === 'upgrade') {
                            const oldSubscriptionId = session.metadata?.oldSubscriptionId

                            if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
                                await stripeSdk.cancelSubscription(oldSubscriptionId)
                                await Subscription.query()
                                    .where('stripe_subscription_id', oldSubscriptionId)
                                    .update({ status: 'canceled' })
                            }
                        }

                        await Subscription.updateOrCreate(
                            { stripeSubscriptionId: subscriptionId },
                            {
                                userId:
                                    (customer?.userId ?? Number(session.metadata?.userId ?? 0)) ||
                                    null,
                                stripeSubscriptionId: subscriptionId,
                                stripeCustomerId: customerId,
                                planId: freshSub.items.data[0]?.price.id ?? null,
                                status: mappedStatus,
                                currentPeriodEnd: await this.resolvePeriodEnd(
                                    freshSub.items.data[0]?.price.id,
                                    periodEnd,
                                    (freshSub as any).current_period_start as number | undefined
                                ),
                                email: customer?.email ?? session.customer_details?.email ?? null,
                            }
                        )

                        break
                    }

                    // One-time (lifetime) path
                    const priceId = session.metadata?.priceId ?? null
                    const customerId =
                        (typeof session.customer === 'string'
                            ? session.customer
                            : (session.customer as any)?.id) ?? null
                    if (!priceId || !customerId) break

                    const customer = await Customer.findBy('stripe_customer_id', customerId)

                    await Subscription.updateOrCreate(
                        { stripeSubscriptionId: session.id },
                        {
                            userId:
                                (customer?.userId ?? Number(session.metadata?.userId ?? 0)) || null,
                            stripeSubscriptionId: session.id,
                            stripeCustomerId: customerId,
                            planId: priceId,
                            status: 'active',
                            currentPeriodEnd: null,
                            email: customer?.email ?? session.customer_details?.email ?? null,
                        }
                    )

                    break
                }

                // ── Subscription created → fires when sub is first made ────────
                // Handles the case where you create subscriptions via API
                // (not checkout), which doesn't fire checkout.session.completed
                case 'customer.subscription.created': {
                    const sub = event.data.object as Stripe.Subscription
                    logger.info('stripe:customer.subscription.created', {
                        ...baseMeta,
                        subscriptionId: sub.id,
                        customerId:
                            typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
                        priceId: sub.items.data[0]?.price.id ?? null,
                    })
                    const customerId =
                        typeof sub.customer === 'string' ? sub.customer : sub.customer.id
                    const customer = await Customer.findBy('stripe_customer_id', customerId)
                    const periodEnd = (sub as any).current_period_end as number | undefined
                    const mappedStatus = this.mapSubscriptionStatus(sub)

                    await Subscription.updateOrCreate(
                        { stripeSubscriptionId: sub.id },
                        {
                            userId: customer?.userId ?? null,
                            stripeSubscriptionId: sub.id,
                            stripeCustomerId: customerId,
                            planId: sub.items.data[0]?.price.id ?? null,
                            status: mappedStatus,
                            currentPeriodEnd: await this.resolvePeriodEnd(
                                sub.items.data[0]?.price.id ?? null,
                                periodEnd,
                                (sub as any).current_period_start as number | undefined
                            ),
                            email: customer?.email ?? null,
                        }
                    )
                    break
                }

                // ── Subscription updated → status changes, renewals ────────────
                case 'customer.subscription.updated': {
                    const sub = event.data.object as Stripe.Subscription
                    logger.info('stripe:customer.subscription.updated', {
                        ...baseMeta,
                        subscriptionId: sub.id,
                        priceId: sub.items.data[0]?.price.id ?? null,
                        status: sub.status,
                    })
                    const periodEnd = (sub as any).current_period_end as number | undefined
                    const mappedStatus = this.mapSubscriptionStatus(sub)

                    await Subscription.updateOrCreate(
                        { stripeSubscriptionId: sub.id },
                        {
                            status: mappedStatus,
                            currentPeriodEnd: await this.resolvePeriodEnd(
                                sub.items.data[0]?.price.id ?? null,
                                periodEnd,
                                (sub as any).current_period_start as number | undefined
                            ),
                        }
                    )
                    break
                }

                // ── Subscription deleted → mark as canceled ────────────────────
                case 'customer.subscription.deleted': {
                    const sub = event.data.object as Stripe.Subscription
                    await Subscription.query()
                        .where('stripe_subscription_id', sub.id)
                        .update({ status: 'canceled' })
                    break
                }

                // ── Invoice paid → fires on every renewal ──────────────────────
                // This is how you keep currentPeriodEnd up to date each month
                case 'invoice.paid':
                case 'invoice.payment_succeeded': {
                    const invoice = event.data.object as any
                    logger.info('stripe:invoice.paid', {
                        ...baseMeta,
                        invoiceId: invoice.id,
                        subscriptionId: invoice.subscription ?? null,
                    })

                    if (!invoice.subscription) break

                    // Fetch fresh subscription data to get updated period
                    const sub = await stripeSdk.retrieveSubscription(invoice.subscription as string)
                    const periodEnd = (sub as any).current_period_end as number | undefined
                    const mappedStatus = this.mapSubscriptionStatus(sub)

                    await Subscription.query()
                        .where('stripe_subscription_id', invoice.subscription as string)
                        .update({
                            status: mappedStatus,
                            current_period_end: await this.resolvePeriodEnd(
                                sub.items.data[0]?.price.id ?? null,
                                periodEnd,
                                (sub as any).current_period_start as number | undefined
                            ),
                        })
                    break
                }

                // ── Invoice payment failed → mark as past_due ──────────────────
                case 'invoice.payment_failed': {
                    const invoice = event.data.object as any
                    logger.warn('stripe:invoice.payment_failed', {
                        ...baseMeta,
                        invoiceId: invoice.id,
                        subscriptionId: invoice.subscription ?? null,
                    })

                    if (!invoice.subscription) break

                    await Subscription.query()
                        .where('stripe_subscription_id', invoice.subscription as string)
                        .update({ status: 'past_due' })
                    break
                }

                // ── Everything else → safely ignored ───────────────────────────
                default:
                    // Not an error — just events we don't act on
                    break // ← remove the console.log noise in production
            }
        } catch (err: any) {
            logger.error('stripe:webhook.error', {
                ...baseMeta,
                message: err?.message,
            })
            throw err
        }
    }
    async createCheckoutSession(userId: number, email: string, name: string, priceId: string) {
        let customer = await Customer.findBy('userId', userId)

        if (!customer) {
            const stripeCustomer = await stripeSdk.createCustomer({ email, name })

            customer = await Customer.create({
                userId,
                stripeCustomerId: stripeCustomer.id,
                email,
                name,
            })
        }

        const reusableSession = await this.findReusableCheckoutSession(
            customer.stripeCustomerId,
            userId,
            priceId
        )

        if (reusableSession) {
            return reusableSession
        }

        const price = await stripeSdk.retrievePrice(priceId)
        const isRecurring = Boolean((price as any).recurring)

        const appUrl = process.env.APP_URL ?? 'http://localhost:3333'

        const idempotencyBucket = Math.floor(
            Date.now() / 1000 / CHECKOUT_IDEMPOTENCY_BUCKET_SECONDS
        )
        const idempotencyKey = `checkout-${customer.stripeCustomerId}-${priceId}-${idempotencyBucket}`

        const session = await stripeSdk.createCheckoutSession({
            mode: isRecurring ? 'subscription' : 'payment',
            customerId: customer.stripeCustomerId,
            clientReferenceId: String(userId),
            lineItems: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            successUrl: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${appUrl}/cancel`,
            metadata: {
                userId: userId.toString(),
                email: email,
                priceId: priceId,
                action: isRecurring ? 'subscribe' : 'lifetime',
            },
            idempotencyKey,
        })

        return session
    }

    async createBillingPortalSession(customerId: string, returnUrl: string) {
        const session = await stripeSdk.createBillingPortalSession({
            customerId,
            returnUrl,
        })

        return { url: session.url }
    }

    async createSubscriptionSwitchSession(subscriptionId: string, returnUrl: string) {
        const sub = await stripeSdk.retrieveSubscription(subscriptionId)
        const customerId =
            typeof sub.customer === 'string' ? sub.customer : (sub.customer as any).id

        const session = await stripeSdk.createBillingPortalSession({
            customerId,
            returnUrl,
            flowData: {
                type: 'subscription_update',
                subscription_update: {
                    subscription: subscriptionId,
                },
            },
        })

        return { url: session.url }
    }

    async getLatestOpenInvoice(customerId: string) {
        return stripeSdk.getLatestOpenInvoice({
            customerId,
            expand: ['data.payment_intent'],
        })
    }

    async createUpgradeCheckoutSession(
        subscriptionId: string,
        priceId: string,
        userId: number,
        email: string,
        name: string
    ) {
        let customer = await Customer.findBy('userId', userId)

        if (!customer) {
            const stripeCustomer = await stripeSdk.createCustomer({ email, name })

            customer = await Customer.create({
                userId,
                stripeCustomerId: stripeCustomer.id,
                email,
                name,
            })
        }

        const reusable = await this.findReusableUpgradeSession(
            customer.stripeCustomerId,
            userId,
            priceId,
            subscriptionId
        )

        if (reusable) {
            return reusable
        }

        const appUrl = process.env.APP_URL ?? 'http://localhost:3333'
        const idempotencyBucket = Math.floor(
            Date.now() / 1000 / CHECKOUT_IDEMPOTENCY_BUCKET_SECONDS
        )
        const idempotencyKey = `upgrade-checkout-${customer.stripeCustomerId}-${subscriptionId}-${priceId}-${idempotencyBucket}`

        const session = await stripeSdk.createCheckoutSession({
            mode: 'subscription',
            customerId: customer.stripeCustomerId,
            clientReferenceId: String(userId),
            lineItems: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            successUrl: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${appUrl}/cancel`,
            metadata: {
                action: 'upgrade',
                oldSubscriptionId: subscriptionId,
                userId: userId.toString(),
                email: email,
                priceId: priceId,
            },
            idempotencyKey,
        })

        return session
    }

    async upgradeSubscription(subscriptionId: string, newPriceId: string, userId: number) {
        const sub = await stripeSdk.retrieveSubscription({
            subscriptionId,
            expand: ['latest_invoice.payment_intent'],
        })
        const itemId = sub.items.data[0]?.id

        if (!itemId) {
            throw new Error('No subscription item found')
        }

        const updated = await stripeSdk.updateSubscription(
            subscriptionId,
            {
                items: [{ id: itemId, price: newPriceId }],
                payment_behavior: 'pending_if_incomplete',
                proration_behavior: 'always_invoice',
                expand: ['latest_invoice.payment_intent'],
            },
            {
                idempotencyKey: `upgrade-${subscriptionId}-${newPriceId}-${userId}-${new Date()
                    .toISOString()
                    .slice(0, 16)}`,
            }
        )

        const periodEnd = (updated as any).current_period_end as number | undefined
        const paymentIntent = (updated.latest_invoice as any)?.payment_intent

        await Subscription.query()
            .where('stripe_subscription_id', subscriptionId)
            .update({
                planId: newPriceId,
                status: this.mapSubscriptionStatus(updated),
                current_period_end: await this.resolvePeriodEnd(
                    newPriceId,
                    periodEnd,
                    (updated as any).current_period_start as number | undefined
                ),
            })

        return {
            subscriptionId: updated.id,
            status: this.mapSubscriptionStatus(updated),
            clientSecret: paymentIntent?.client_secret ?? null,
            requiresAction: Boolean(paymentIntent?.client_secret),
        }
    }
}
