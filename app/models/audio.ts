import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, manyToMany, scope } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Genre from './genre.js'
import Mood from './mood.js'
import Review from './review.js'
import Favorite from './favourite.js'

export default class Audio extends BaseModel {
    static knexQuery() {
        throw new Error('Method not implemented.')
    }
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare sellerId: number

    @belongsTo(() => User, {
        foreignKey: 'sellerId',
    })
    declare seller: BelongsTo<typeof User>

    @column()
    declare title: string

    @column({ columnName: 'cover_image_url' })
    declare imageUrl: string

    @column()
    declare slug: string

    @column({ columnName: 'file_url' })
    declare fileUrl: string

    @column()
    declare bpm: number

    @column()
    declare duration: number

    @column()
    declare status: 'pending' | 'reject' | 'approve'

    @column()
    declare rejectReason: string | null

    @column()
    declare reviewedBy: number | null

    @belongsTo(() => User, {
        foreignKey: 'reviewedBy',
    })
    declare admin: BelongsTo<typeof User> | null

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: false })
    declare reviewedAt: DateTime | null

    @column.dateTime()
    declare deletedAt: DateTime | null

    @manyToMany(() => Genre, {
        pivotTable: 'audio_genres',
    })
    declare genres: ManyToMany<typeof Genre>

    @manyToMany(() => Mood, {
        pivotTable: 'audio_moods',
    })
    declare moods: ManyToMany<typeof Mood>

    @hasMany(() => Review)
    declare reviews: HasMany<typeof Review>

    @hasMany(() => Favorite)
    declare favorites: HasMany<typeof Favorite>

    public static approved = scope((query) => {
        query.where('status', 'approve').whereNull('deleted_at')
    })
}
