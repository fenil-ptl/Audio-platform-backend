import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Subscription from '#models/subscription'
import Audio from '#models/audio'
import { getPlanLimits } from '#config/plan_limits'
import { DateTime } from 'luxon'

export default class CheckSubscriptionMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        const { auth, response } = ctx
        const user = auth.user!

        // 1. Inspect latest subscription to enforce cancel/active rules
        const subscription = await Subscription.query()
            .where('user_id', user.id)
            .orderBy('created_at', 'desc')
            .first()

        if (!subscription) {
            return response.forbidden({
                success: false,
                message: 'An active subscription is required to upload tracks.',
                action: 'SUBSCRIBE',
            })
        }

        const now = DateTime.now()

        if (subscription.status === 'cancel_at_period_end') {
            const endsAt = subscription.currentPeriodEnd?.toFormat('dd MMM yyyy') ?? 'soon'
            return response.forbidden({
                success: false,
                message: `Your subscription ends on ${endsAt}. Renew or upgrade to upload tracks.`,
                action: 'RENEW',
                activeUntil: endsAt,
            })
        }

        if (subscription.status === 'past_due') {
            return response.forbidden({
                success: false,
                message: 'Payment failed. Update your payment method to continue uploading.',
                action: 'UPDATE_PAYMENT',
            })
        }

        if (subscription.status === 'incomplete') {
            return response.forbidden({
                success: false,
                message: 'Complete your pending payment to activate uploads.',
                action: 'COMPLETE_PAYMENT',
            })
        }

        if (!['active', 'trialing'].includes(subscription.status)) {
            return response.forbidden({
                success: false,
                message: 'An active subscription is required to upload tracks.',
                action: 'SUBSCRIBE',
            })
        }

        if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) {
            return response.forbidden({
                success: false,
                message: 'Your subscription has expired. Renew to upload tracks.',
                action: 'RENEW',
            })
        }

        // 2. Get plan limits for their price
        const limits = getPlanLimits(subscription.planId)

        if (!limits) {
            return response.forbidden({
                success: false,
                message: 'Unknown plan. Please contact support.',
            })
        }

        // 3. Check monthly upload count
        if (limits.tracksPerMonth !== -1) {
            const startOfMonth = DateTime.now().startOf('month').toSQL()!

            const uploadedThisMonth = await Audio.query()
                .where('seller_id', user.id)
                .whereNull('deleted_at')
                .where('created_at', '>=', startOfMonth)
                .count('* as total')
                .first()

            const count = Number((uploadedThisMonth as any).$extras.total ?? 0)

            if (count >= limits.tracksPerMonth) {
                return response.tooManyRequests({
                    success: false,
                    message: `Monthly upload limit reached (${limits.tracksPerMonth} tracks). Upgrade your plan.`,
                    limit: limits.tracksPerMonth,
                    used: count,
                    action: 'UPGRADE',
                })
            }
        }

        // 4. Check total stored tracks
        if (limits.totalTracks !== -1) {
            const totalStored = await Audio.query()
                .where('seller_id', user.id)
                .whereNull('deleted_at')
                .count('* as total')
                .first()

            const total = Number((totalStored as any).$extras.total ?? 0)

            if (total >= limits.totalTracks) {
                return response.tooManyRequests({
                    success: false,
                    message: `Total track limit reached (${limits.totalTracks} tracks). Upgrade your plan or delete old tracks.`,
                    limit: limits.totalTracks,
                    used: total,
                    action: 'UPGRADE',
                })
            }
        }

        // 5. Attach limits to ctx so the controller can use them
        ;(ctx as any).planLimits = limits
        ;(ctx as any).activeSubscription = subscription

        return next()
    }
}
