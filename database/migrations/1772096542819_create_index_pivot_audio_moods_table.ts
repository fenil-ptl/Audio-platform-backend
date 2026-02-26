import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'index_pivot_audio_moods'

  async up() {
    this.schema.alterTable('audio_moods', (table) => {
      table.index(['mood_id', 'audio_id'], 'idx_audio_mood_combo')
      table.index(['audio_id'], 'idx_audio_mood_audio')
    })
  }

  async down() {
    this.schema.alterTable('audio_moods', (table) => {
      table.dropIndex(['mood_id', 'audio_id'], 'idx_audio_mood_combo')
      table.dropIndex(['audio_id'], 'idx_audio_mood_audio')
    })
  }
}
