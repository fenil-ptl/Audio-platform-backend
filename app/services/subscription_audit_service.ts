import SubscriptionEvent from '#models/subscription_event'
import { DateTime } from 'luxon'

interface AuditPayload {
    userId: number
    subscriptionId?: string | null
    event: string
    fromStatus?: string | null
    toStatus?: string | null
    fromPlan?: string | null
    toPlan?: string | null
    ipAddress?: string | null
    metadata?: Record<string, any> | null
}

export default class SubscriptionAuditService {
    static async log(data: AuditPayload): Promise<void> {
        try {
            await SubscriptionEvent.create({
                userId: data.userId,
                subscriptionId: data.subscriptionId ?? null,
                event: data.event,
                fromStatus: data.fromStatus ?? null,
                toStatus: data.toStatus ?? null,
                fromPlan: data.fromPlan ?? null,
                toPlan: data.toPlan ?? null,
                ipAddress: data.ipAddress ?? null,
                metadata: data.metadata ?? null,
                createdAt: DateTime.now(), // ← import DateTime from luxon
            })
        } catch (err) {
            // Never crash the main flow because of audit failure
            // Log to console so you can monitor it without breaking payments
            console.error('[AuditLog] Failed to write subscription event:', err)
        }
    }

    // Fetch full history for a user — useful for admin panel or support
    static async getHistory(userId: number, limit = 50) {
        return SubscriptionEvent.query()
            .where('user_id', userId)
            .orderBy('created_at', 'desc')
            .limit(limit)
    }

    // Fetch all events for a specific subscription
    static async getBySubscription(subscriptionId: string) {
        return SubscriptionEvent.query()
            .where('subscription_id', subscriptionId)
            .orderBy('created_at', 'desc')
    }
}
