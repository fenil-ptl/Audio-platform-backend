import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Payment extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare paymentIntentId: string

    @column()
    declare customerEmail: string | null

    @column()
    declare amount: number // stored in cents

    @column()
    declare currency: string

    @column()
    declare status: string

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime
}
