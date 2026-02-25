import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio'

  async up() {
    this.schema.raw(`
      UPDATE audio
      SET deleted_at = NULL
      WHERE deleted_at IS NOT NULL
    `)

    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('deleted_at').nullable().defaultTo(null).alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('deleted_at').defaultTo(this.now()).alter()
    })
  }
}
