import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audio_genres'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('audio_id').unsigned().references('id').inTable('audio').onDelete('CASCADE')
      table.integer('genre_id').unsigned().references('id').inTable('genres').onDelete('CASCADE')
      table.unique(['audio_id', 'genre_id'])
      table.timestamps(true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
