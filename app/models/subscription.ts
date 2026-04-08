import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Subscription extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column({ columnName: 'user_id' })
    declare userId: number | null

    @column({ columnName: 'stripe_subscription_id' })
    declare stripeSubscriptionId: string

    @column({ columnName: 'stripe_customer_id' })
    declare stripeCustomerId: string

    @column()
    declare email: string | null

    @column({ columnName: 'plan_id' })
    declare planId: string | null

    @column()
    declare status: string

    @column.dateTime({ columnName: 'current_period_end' })
    declare currentPeriodEnd: DateTime | null

    @belongsTo(() => User)
    declare user: BelongsTo<typeof User>

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime
}
