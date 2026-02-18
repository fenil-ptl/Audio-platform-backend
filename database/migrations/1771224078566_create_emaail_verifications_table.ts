import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_verification_tokens'

  /**
   * Run the migrations
   */
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // Primary Key & Foreign Key (UUID)
      table.increments('id')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')

      // Token logic
      table.string('token').notNullable().unique()
      table.timestamp('expires_at').notNullable()

      // Timestamps
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  /**
   * Reverse the migrations
   */
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
