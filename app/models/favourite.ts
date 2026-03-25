import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Audio from '#models/audio'

export default class Favourite extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare userId: number

    @column()
    declare audioId: number

    @belongsTo(() => User)
    declare user: BelongsTo<typeof User>

    @belongsTo(() => Audio)
    declare audio: BelongsTo<typeof Audio>

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime
}
