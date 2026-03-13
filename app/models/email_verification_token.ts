import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class EmailVerificationToken extends BaseModel {
    @column({ isPrimary: true })
    declare id: string

    @column()
    declare userId: number

    @column()
    declare token: string

    @column.dateTime()
    declare expiresAt: DateTime

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime

    @belongsTo(() => User)
    declare user: BelongsTo<typeof User>

    public static valid = scope((query: any) => {
        return query.where('expires_at', '>', DateTime.now().toSQL())
    })
}
