import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['status', 'deleted_at'], 'audio_status_deleted_at_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['status', 'deleted_at'], 'audio_status_deleted_at_index')
    })
  }
}
