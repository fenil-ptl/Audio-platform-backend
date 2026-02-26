import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('audio_genres', (table) => {
      table.index(['genre_id', 'audio_id'], 'idx_audio_genre_combo')
      table.index(['audio_id'], 'idx_audio_genre_audio')
    })
  }

  async down() {
    this.schema.alterTable('audio_genres', (table) => {
      table.dropIndex(['genre_id', 'audio_id'], 'idx_audio_genre_combo')
      table.dropIndex(['audio_id'], 'idx_audio_genre_audio')
    })
  }
}
