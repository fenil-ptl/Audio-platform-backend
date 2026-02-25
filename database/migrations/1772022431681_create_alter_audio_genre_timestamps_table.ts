import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio_genres'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('created_at').defaultTo(this.now()).alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('created_at')
    })
  }
}
