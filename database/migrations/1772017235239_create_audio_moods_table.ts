import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio_moods'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('audio_id').unsigned().references('id').inTable('audio').onDelete('CASCADE')
      table.integer('mood_id').unsigned().references('id').inTable('moods').onDelete('CASCADE')
      table.unique(['audio_id', 'mood_id'])
      table.timestamps(true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
