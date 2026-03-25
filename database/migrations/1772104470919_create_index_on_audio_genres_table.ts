import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    async up() {
        this.schema.alterTable('audio_genres', (table) => {
            // ✅ Only add index if it doesn't already exist
            table.index(['audio_id', 'genre_id'], 'audio_genres_audio_id_genre_id_index')
        })
    }

    async down() {
        this.schema.alterTable('audio_genres', (table) => {
            table.dropIndex(['audio_id', 'genre_id'], 'audio_genres_audio_id_genre_id_index')
        })
    }
}
