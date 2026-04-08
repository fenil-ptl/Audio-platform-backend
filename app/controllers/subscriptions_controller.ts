import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import StripeService from '#services/stripe_service'
import Customer from '#models/customer'
import Subscription from '#models/subscription'
import vine from '@vinejs/vine'
import SubscriptionAuditService from '#services/subscription_audit_service'

const stripeService = new StripeService()

export default class SubscriptionsController {
    async createCustomer({ auth, response }: HttpContext) {
        const user = auth.user!

        const existing = await Customer.findBy('user_id', user.id)
        if (existing) {
            await SubscriptionAuditService.log({
                userId: user.id,
                event: 'create_customer_blocked_already_exists',
                metadata: { existingStripeCustomerId: existing.stripeCustomerId },
            })
            return response.ok({
                success: true,
                customerId: existing.stripeCustomerId,
                email: existing.email,
                alreadyExists: true,
                message: 'You already have a Stripe customer account.',
            })
        }

        try {
            const result = await stripeService.createCustomer(
                user.email,
                user.id,
                user.fullName ?? undefined
            )
            await SubscriptionAuditService.log({
                userId: user.id,
                event: 'customer_created',
                metadata: { stripeCustomerId: result.customerId, email: result.email },
            })
            return response.created({
                success: true,
                message: 'Customer created successfully.',
                data: result,
            })
        } catch (err: any) {
            await SubscriptionAuditService.log({
                userId: user.id,
                event: 'customer_create_stripe_error',
                metadata: { error: err?.message ?? null },
            })
            throw new Exception('Payment provider unavailable. Please try again shortly.', {
                status: 502,
            })
        }
    }

    async create({ request, auth, response }: HttpContext) {
        const user = auth.user!

        const { priceId } = await request.validateUsing(
            vine.compile(vine.object({ priceId: vine.string() }))
        )

        const customer = await Customer.findBy('user_id', user.id)
        if (!customer) {
            await SubscriptionAuditService.log({
                userId: user.id,
                event: 'create_blocked_no_customer',
                ipAddress: request.ip(),
                metadata: { attemptedPriceId: priceId },
            })
            throw new Exception(
                'No billing account found. Call POST /api/subscriptions/customers first.',
                { status: 400 }
            )
        }

        const existingSub = await Subscription.query()
            .where('user_id', user.id)
            .whereNotIn('status', ['canceled', 'incomplete_expired'])
            .orderBy('created_at', 'desc')
            .first()

        if (existingSub) {
            if (['active', 'trialing'].includes(existingSub.status)) {
                await SubscriptionAuditService.log({
                    userId: user.id,
                    subscriptionId: existingSub.stripeSubscriptionId,
                    event: 'create_blocked_already_active',
                    fromStatus: existingSub.status,
                    fromPlan: existingSub.planId,
                    ipAddress: request.ip(),
                    metadata: { attemptedPriceId: priceId },
                })
                throw new Exception(
                    `You already have an active subscription (${existingSub.planId}). ` +
                        `Use PATCH /api/subscriptions/${existingSub.stripeSubscriptionId}/upgrade to change plans.`,
                    { status: 409 }
                )
            }

            if (existingSub.status === 'past_due') {
                await SubscriptionAuditService.log({
                    userId: user.id,
                    subscriptionId: existingSub.stripeSubscriptionId,
                    event: 'create_blocked_past_due',
                    fromStatus: 'past_due',
                    fromPlan: existingSub.planId,
                    ipAddress: request.ip(),
                    metadata: { attemptedPriceId: priceId },
                })
                throw new Exception(
                    'Your current subscription has an unpaid invoice. ' +
                        'Please update your payment method before subscribing again.',
                    { status: 409 }
                )
            }

            if (existingSub.status === 'incomplete') {
                await SubscriptionAuditService.log({
                    userId: user.id,
                    subscriptionId: existingSub.stripeSubscriptionId,
                    event: 'create_blocked_incomplete',
                    fromStatus: 'incomplete',
                    fromPlan: existingSub.planId,
                    ipAddress: request.ip(),
                    metadata: { attemptedPriceId: priceId },
                })
                throw new Exception(
                    'A pending subscription already exists. ' +
                        'Please complete the payment or wait 24 hours for it to expire.',
                    { status: 409 }
                )
            }

            if (existingSub.status === 'cancel_at_period_end') {
                const endsAt = existingSub.currentPeriodEnd?.toFormat('dd MMM yyyy') ?? 'soon'
                await SubscriptionAuditService.log({
                    userId: user.id,
                    subscriptionId: existingSub.stripeSubscriptionId,
                    event: 'create_blocked_cancel_at_period_end',
                    fromStatus: 'cancel_at_period_end',
                    fromPlan: existingSub.planId,
                    ipAddress: request.ip(),
                    metadata: { attemptedPriceId: priceId, endsAt },
                })
                throw new Exception(
                    `Your current subscription is active until ${endsAt}. ` +
                        `You can subscribe to a new plan after it ends.`,
                    { status: 409 }
                )
            }
        }

        const validPriceIds = [
            process.env.PRICE_PERSONAL,
            process.env.PRICE_PROFESSIONAL,
            process.env.PRICE_STARTUP,
            process.env.PRICE_BUSINESS,
            process.env.PRICE_LIFETIME,
        ].filter(Boolean)

        if (!validPriceIds.includes(priceId)) {
            await SubscriptionAuditService.log({
                userId: user.id,
                event: 'create_blocked_invalid_price',
                ipAddress: request.ip(),
                metadata: { attemptedPriceId: priceId },
            })
            throw new Exception('Invalid plan selected.', { status: 400 })
        }

        let result: Awaited<ReturnType<typeof stripeService.createSubscription>>
        try {
            result = await stripeService.createSubscription(
                customer.stripeCustomerId,
                priceId,
                user.id
            )
        } catch (err: any) {
            if (err?.code === 'subscription_exists') {
                throw new Exception(
                    'You already have an active or pending subscription. Please manage or cancel it before creating a new one.',
                    { status: 409 }
                )
            }

            await SubscriptionAuditService.log({
                userId: user.id,
                event: 'create_stripe_error',
                toPlan: priceId,
                ipAddress: request.ip(),
                metadata: {
                    stripeErrorCode: err?.raw?.code ?? null,
                    stripeErrorMessage: err?.message ?? null,
                },
            })
            if (err?.raw?.code === 'resource_missing') {
                throw new Exception('Selected plan does not exist. Contact support.', {
                    status: 400,
                })
            }
            throw new Exception('Failed to create subscription. Please try again.', { status: 502 })
        }

        await SubscriptionAuditService.log({
            userId: user.id,
            subscriptionId: result.subscriptionId,
            event: 'created',
            toStatus: result.status,
            toPlan: priceId,
            ipAddress: request.ip(),
            metadata: {
                stripeCustomerId: customer.stripeCustomerId,
                stripeStatus: result.status,
            },
        })

        return response.created(result)
    }

    async cancel({ params, auth, request, response }: HttpContext) {
        const user = auth.user!

        const subscription = await Subscription.query()
            .where('stripe_subscription_id', params.subscriptionId)
            .where('user_id', user.id)
            .first()

        if (!subscription) {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: params.subscriptionId,
                event: 'cancel_blocked_not_found',
                ipAddress: request.ip(),
            })
            throw new Exception('Subscription not found.', { status: 404 })
        }

        if (subscription.status === 'canceled') {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'cancel_blocked_already_canceled',
                fromStatus: 'canceled',
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
            })
            throw new Exception('This subscription is already canceled.', { status: 409 })
        }

        if (subscription.status === 'cancel_at_period_end') {
            const endsAt = subscription.currentPeriodEnd?.toFormat('dd MMM yyyy') ?? 'soon'
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'cancel_blocked_already_scheduled',
                fromStatus: 'cancel_at_period_end',
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
                metadata: { endsAt },
            })
            throw new Exception(`Subscription is already scheduled to cancel on ${endsAt}.`, {
                status: 409,
            })
        }

        if (subscription.status === 'incomplete') {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'cancel_blocked_incomplete',
                fromStatus: 'incomplete',
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
            })
            throw new Exception(
                'Cannot cancel an incomplete subscription. It will expire automatically in 24 hours.',
                { status: 400 }
            )
        }

        if (process.env.PRICE_LIFETIME && subscription.planId === process.env.PRICE_LIFETIME) {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'cancel_blocked_lifetime',
                fromStatus: subscription.status,
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
            })
            throw new Exception('Lifetime plan cannot be canceled.', { status: 409 })
        }

        const forceNow = request.qs().force === 'true'
        let result: Awaited<ReturnType<typeof stripeService.cancelSubscription>>
        try {
            result = await stripeService.cancelSubscription(
                subscription.stripeSubscriptionId,
                forceNow
            )
        } catch (err: any) {
            if (err?.code === 'lifetime_non_cancelable') {
                throw new Exception('Lifetime plan cannot be canceled.', { status: 409 })
            }
            throw err
        }

        await SubscriptionAuditService.log({
            userId: user.id,
            subscriptionId: subscription.stripeSubscriptionId,
            event: forceNow ? 'canceled_immediately' : 'cancel_scheduled',
            fromStatus: subscription.status,
            toStatus: forceNow ? 'canceled' : 'cancel_at_period_end',
            fromPlan: subscription.planId,
            ipAddress: request.ip(),
            metadata: { force: forceNow },
        })

        return response.ok(result)
    }

    async show({ params, auth, response }: HttpContext) {
        const user = auth.user!

        await Subscription.query()
            .where('stripe_subscription_id', params.subscriptionId)
            .where('user_id', user.id)
            .firstOrFail()

        const result = await stripeService.getSubscription(params.subscriptionId)
        return response.ok(result)
    }

    async me({ auth, response }: HttpContext) {
        const user = auth.user!

        const subscription = await Subscription.query()
            .where('user_id', user.id)
            .whereIn('status', ['active', 'trialing', 'past_due', 'cancel_at_period_end'])
            .orderBy('created_at', 'desc')
            .first()

        if (!subscription) {
            return response.ok({ hasSubscription: false, status: null })
        }

        return response.ok({
            hasSubscription: true,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            planId: subscription.planId,
        })
    }

    async upgrade({ params, request, auth, response }: HttpContext) {
        const user = auth.user!
        const { priceId } = await request.validateUsing(
            vine.compile(vine.object({ priceId: vine.string().trim() }))
        )

        const subscription = await Subscription.query()
            .where('stripe_subscription_id', params.subscriptionId)
            .where('user_id', user.id)
            .first()

        if (!subscription) {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: params.subscriptionId,
                event: 'upgrade_blocked_not_found',
                ipAddress: request.ip(),
                metadata: { attemptedPriceId: priceId },
            })
            throw new Exception('Subscription not found.', { status: 404 })
        }

        if (!['active', 'trialing'].includes(subscription.status)) {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'upgrade_blocked_invalid_status',
                fromStatus: subscription.status,
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
                metadata: { attemptedPriceId: priceId },
            })
            throw new Exception('Can only upgrade an active or trialing subscription.', {
                status: 409,
            })
        }

        if (process.env.PRICE_LIFETIME && subscription.planId === process.env.PRICE_LIFETIME) {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'upgrade_blocked_lifetime',
                fromStatus: subscription.status,
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
                metadata: { attemptedPriceId: priceId },
            })
            throw new Exception('Lifetime plan cannot be changed via upgrade.', { status: 409 })
        }

        if (subscription.planId === priceId) {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'upgrade_blocked_same_plan',
                fromStatus: subscription.status,
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
                metadata: { attemptedPriceId: priceId },
            })
            throw new Exception('You are already on this plan.', { status: 409 })
        }

        const validPriceIds = [
            process.env.PRICE_PERSONAL,
            process.env.PRICE_PROFESSIONAL,
            process.env.PRICE_STARTUP,
            process.env.PRICE_BUSINESS,
            process.env.PRICE_LIFETIME,
        ].filter(Boolean)

        if (!validPriceIds.includes(priceId)) {
            await SubscriptionAuditService.log({
                userId: user.id,
                subscriptionId: subscription.stripeSubscriptionId,
                event: 'upgrade_blocked_invalid_price',
                fromPlan: subscription.planId,
                ipAddress: request.ip(),
                metadata: { attemptedPriceId: priceId },
            })
            throw new Exception('Invalid plan selected.', { status: 400 })
        }

        const userName = user.fullName ?? 'Valued Customer'
        const session = await stripeService.createUpgradeCheckoutSession(
            subscription.stripeSubscriptionId,
            priceId,
            user.id,
            user.email,
            userName
        )

        await SubscriptionAuditService.log({
            userId: user.id,
            subscriptionId: subscription.stripeSubscriptionId,
            event: 'upgrade_checkout_started',
            fromStatus: subscription.status,
            fromPlan: subscription.planId,
            toPlan: priceId,
            ipAddress: request.ip(),
        })

        return response.ok({
            success: true,
            message: 'Open the provided URL to complete your upgrade.',
            url: session.url,
            mode: 'checkout_session',
        })
    }

    async billingPortal({ auth, response }: HttpContext) {
        const user = auth.user!
        const customer = await Customer.findBy('user_id', user.id)

        if (!customer) {
            throw new Exception(
                'No billing account found. Create one before opening billing portal.',
                {
                    status: 400,
                }
            )
        }

        const appUrl = process.env.APP_URL ?? 'http://localhost:3333'
        const portal = await stripeService.createBillingPortalSession(
            customer.stripeCustomerId,
            `${appUrl}/billing/return`
        )

        await SubscriptionAuditService.log({
            userId: user.id,
            event: 'billing_portal_opened',
            metadata: { stripeCustomerId: customer.stripeCustomerId },
        })

        return response.ok({ success: true, url: portal.url })
    }

    async health({ auth, response }: HttpContext) {
        const user = auth.user!

        const subscription = await Subscription.query()
            .where('user_id', user.id)
            .orderBy('created_at', 'desc')
            .first()

        if (!subscription) {
            return response.ok({
                hasSubscription: false,
                action: 'SUBSCRIBE',
            })
        }

        const base = {
            hasSubscription: true,
            status: subscription.status,
            planId: subscription.planId,
            currentPeriodEnd: subscription.currentPeriodEnd,
        }

        if (subscription.status === 'past_due' || subscription.status === 'incomplete') {
            const invoice = await stripeService.getLatestOpenInvoice(subscription.stripeCustomerId)
            const pi = (invoice as any)?.payment_intent as any

            return response.ok({
                ...base,
                action: 'UPDATE_PAYMENT',
                invoiceId: invoice?.id ?? null,
                amountDue: invoice?.amount_due ?? null,
                currency: invoice?.currency ?? null,
                hostedInvoiceUrl: invoice?.hosted_invoice_url ?? null,
                paymentIntentClientSecret: pi?.client_secret ?? null,
                paymentIntentStatus: pi?.status ?? null,
                nextActionType: pi?.next_action?.type ?? null,
            })
        }

        if (subscription.status === 'cancel_at_period_end') {
            return response.ok({
                ...base,
                action: 'RENEW',
                activeUntil: subscription.currentPeriodEnd,
            })
        }

        return response.ok({
            ...base,
            action: 'OK',
        })
    }
}
