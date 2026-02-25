import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['status'], 'audio_status_index')
      table.index(['deleted_at'], 'audio_deleted_at_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['status'], 'audio_status_index')
      table.dropIndex(['deleted_at'], 'audio_deleted_at_index')
    })
  }
}
