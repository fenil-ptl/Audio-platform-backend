import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('seller_id')
        .unsigned()
        .references('users.id')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
        .notNullable()

      table.string('title').notNullable()
      table.string('slug').notNullable()
      table.string('file-url').notNullable()
      table.string('cover-image-url').notNullable()
      table.integer('bpm').notNullable()
      table.integer('duration').notNullable()
      table.enum('status', ['pending', 'reject', 'approve']).notNullable().defaultTo('pending')
      table.string('reject_reason').nullable()
      table
        .integer('reviewed_by')
        .unsigned()
        .references('users.id')
        .onDelete('SET NULL') // If admin is deleted, we keep the audio record
        .onUpdate('CASCADE')
        .nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('reviewed_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
