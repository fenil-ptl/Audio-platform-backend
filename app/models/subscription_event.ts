import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class SubscriptionEvent extends BaseModel {
    public static table = 'subscription_events'

    @column({ isPrimary: true })
    declare id: number

    @column()
    declare userId: number

    @column()
    declare subscriptionId: string | null

    @column()
    declare event: string

    @column()
    declare fromStatus: string | null

    @column()
    declare toStatus: string | null

    @column()
    declare fromPlan: string | null

    @column()
    declare toPlan: string | null

    @column()
    declare ipAddress: string | null

    @column({
        prepare: (value) => (value ? JSON.stringify(value) : null),
        consume: (value) => {
            if (!value) return null
            try {
                return JSON.parse(value)
            } catch {
                return value
            }
        },
    })
    declare metadata: Record<string, any> | null

    @column.dateTime({ autoCreate: false })
    declare createdAt: DateTime

    @belongsTo(() => User)
    declare user: BelongsTo<typeof User>
}
