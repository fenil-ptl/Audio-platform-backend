import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class PasswordResetToken extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare userId: number

    @belongsTo(() => User, {
        foreignKey: 'userId',
    })
    declare user: BelongsTo<typeof User>

    @column()
    declare token: string

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime()
    declare expiresAt: DateTime

    static valid = scope((query) => {
        query.where('expires_at', '>', DateTime.now().toSQL())
    })
}
