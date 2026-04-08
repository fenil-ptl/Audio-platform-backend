import type { HttpContext } from '@adonisjs/core/http'
import StripeService from '#services/stripe_service'
import vine from '@vinejs/vine'
import Subscription from '#models/subscription'
const stripeService = new StripeService()

function normalizePlanId(planId: string | null | undefined) {
    if (!planId) return planId

    const aliasToEnvValue: Record<string, string | undefined> = {
        price_personal: process.env.PRICE_PERSONAL,
        price_professional: process.env.PRICE_PROFESSIONAL,
        price_startup: process.env.PRICE_STARTUP,
        price_business: process.env.PRICE_BUSINESS,
        price_lifetime: process.env.PRICE_LIFETIME,
    }

    return aliasToEnvValue[planId] ?? planId
}

// Validation schema for creating a payment intent

export default class PaymentsController {
    /**
     * POST /api/payments/intent
     * Creates a Stripe PaymentIntent and returns client_secret.
     */
    async createIntent({ request, response }: HttpContext) {
        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    priceId: vine.string(),
                    email: vine.string().email().optional(),
                })
            )
        )

        const result = await stripeService.createPaymentIntentForPrice(
            payload.priceId,
            payload.email
        )

        return response.created(result)
    }

    /**
     * GET /api/payments/status/:paymentIntentId
     * Fetches the current status of a PaymentIntent from Stripe.
     */
    async status({ params, response }: HttpContext) {
        const result = await stripeService.getPaymentIntentStatus(params.paymentIntentId)
        return response.ok(result)
    }

    /**
     * POST /api/payments/refund
     * Issues a full or partial refund.
     * Send { paymentIntentId, amount? } — omit amount for a full refund.
     */
    async refund({ request, response }: HttpContext) {
        const { paymentIntentId, amount } = request.only(['paymentIntentId', 'amount'])

        if (!paymentIntentId) {
            return response.badRequest({ error: 'paymentIntentId is required' })
        }

        if (amount !== undefined && amount <= 0) {
            return response.badRequest({ error: 'amount must be greater than 0' })
        }

        const result = await stripeService.refundPayment(paymentIntentId, amount)
        return response.ok(result)
    }

    /**
     * GET /api/payments
     * Returns all payment records stored in your MySQL database.
     */
    async list({ response }: HttpContext) {
        const payments = await stripeService.listPayments()
        return response.ok(payments)
    }
    async checkoutSession({ auth, request, response }: HttpContext) {
        const user = auth.user!

        const userId = user.id

        const email = user.email
        const userName = user.fullName ?? 'Valued Customer'

        const { priceId } = await request.validateUsing(
            vine.compile(
                vine.object({
                    priceId: vine.string(),
                })
            )
        )

        const validPriceIds = [
            process.env.PRICE_PERSONAL,
            process.env.PRICE_PROFESSIONAL,
            process.env.PRICE_STARTUP,
            process.env.PRICE_BUSINESS,
            process.env.PRICE_LIFETIME,
        ].filter(Boolean)

        if (!validPriceIds.includes(priceId)) {
            return response.badRequest({
                success: false,
                message: 'Invalid plan selected.',
            })
        }

        const existingSub = await Subscription.query()
            .where('user_id', user.id)
            .whereNotIn('status', ['canceled', 'incomplete_expired'])
            .orderBy('created_at', 'desc')
            .first()

        if (existingSub) {
            const currentPlanId = normalizePlanId(existingSub.planId)
            const requestedPlanId = normalizePlanId(priceId)

            // Already paying — block completely
            if (['active', 'trialing'].includes(existingSub.status)) {
                if (currentPlanId !== requestedPlanId) {
                    try {
                        const upgradeSession = await stripeService.createUpgradeCheckoutSession(
                            existingSub.stripeSubscriptionId,
                            priceId,
                            user.id,
                            email,
                            userName
                        )

                        return response.ok({
                            success: true,
                            mode: 'upgrade',
                            url: upgradeSession.url,
                            fromPlan: existingSub.planId,
                            toPlan: priceId,
                        })
                    } catch (err: any) {
                        return response.badGateway({
                            success: false,
                            message: 'Failed to create upgrade checkout session.',
                            stripeError: err?.message ?? null,
                        })
                    }
                }

                return response.conflict({
                    success: false,
                    message: `You already have an active subscription (${existingSub.planId}).`,
                    action: 'UPGRADE',
                    upgradeUrl: `/api/subscriptions/${existingSub.stripeSubscriptionId}/upgrade`,
                })
            }

            // Unpaid invoice on existing sub
            if (existingSub.status === 'past_due') {
                return response.conflict({
                    success: false,
                    message:
                        'Your current subscription has an unpaid invoice. Please update your payment method.',
                    action: 'UPDATE_PAYMENT',
                })
            }

            // Pending first invoice — do not create another subscription/session.
            if (existingSub.status === 'incomplete') {
                return response.conflict({
                    success: false,
                    message:
                        'A pending subscription already exists. Complete its payment or wait for it to expire.',
                    action: 'COMPLETE_PENDING_PAYMENT',
                    subscriptionId: existingSub.stripeSubscriptionId,
                })
            }

            // Canceled at period end — still active until period ends
            if (existingSub.status === 'cancel_at_period_end') {
                if (currentPlanId !== requestedPlanId) {
                    try {
                        const upgradeSession = await stripeService.createUpgradeCheckoutSession(
                            existingSub.stripeSubscriptionId,
                            priceId,
                            user.id,
                            email,
                            userName
                        )

                        return response.ok({
                            success: true,
                            mode: 'upgrade',
                            url: upgradeSession.url,
                            fromPlan: existingSub.planId,
                            toPlan: priceId,
                        })
                    } catch (err: any) {
                        return response.badGateway({
                            success: false,
                            message: 'Failed to create upgrade checkout session.',
                            stripeError: err?.message ?? null,
                        })
                    }
                }

                const endsAt = existingSub.currentPeriodEnd?.toFormat('dd MMM yyyy') ?? 'soon'
                return response.conflict({
                    success: false,
                    message: `Your subscription is active until ${endsAt}. You can subscribe to a new plan after it ends.`,
                    action: 'WAIT',
                    activeUntil: endsAt,
                })
            }
        }

        // Guard 3 — same plan check (if they somehow have a canceled sub on same plan)
        // This catches: canceled sub same plan → allow. Different plan → allow.
        // Already handled above for active subs.

        // All guards passed — create the checkout session

        try {
            const session = await stripeService.createCheckoutSession(
                userId,
                email,
                userName,
                priceId
            )

            return response.ok({
                success: true,
                url: session.url,
            })
        } catch (err: any) {
            return response.internalServerError({
                success: false,
                message: 'Failed to create checkout session. Please try again.',
            })
        }
    }
    async success({ response }: HttpContext) {
        return response.ok({ message: 'Payment successful! Thank you for your purchase.' })
    }
}
