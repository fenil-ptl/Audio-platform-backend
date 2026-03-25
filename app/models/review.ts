import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Audio from '#models/audio'

export default class Review extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare userId: number

    @column()
    declare audioId: number

    @column()
    declare rating: number

    @column()
    declare comment: string | null

    @belongsTo(() => User)
    declare user: BelongsTo<typeof User>

    @belongsTo(() => Audio)
    declare audio: BelongsTo<typeof Audio>

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime
}
