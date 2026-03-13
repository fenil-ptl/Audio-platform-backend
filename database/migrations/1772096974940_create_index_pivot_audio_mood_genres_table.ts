import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    async up() {
        this.schema.alterTable('audio_genres', (table) => {
            table.index(['genre_id'], 'idx_pivot_genre')
        })

        this.schema.alterTable('audio_moods', (table) => {
            table.index(['mood_id'], 'idx_pivot_mood')
        })
    }

    async down() {
        this.schema.alterTable('audio_moods', (table) => {
            table.dropIndex(['mood_id'], 'idx_pivot_mood')
        })

        this.schema.alterTable('audio_genres', (table) => {
            table.dropIndex(['genre_id'], 'idx_pivot_genre')
        })
    }
}
