import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
export default class Audio extends BaseModel {
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

  @column({ columnName: 'cover-image-url' })
  declare imageUrl: string

  @column()
  declare slug: string

  @column({ columnName: 'file-url' })
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

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare reviewedAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare deletedAt: DateTime
}
