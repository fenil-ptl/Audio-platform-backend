import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'audio_genres'

    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            // Add optimized composite index for filtering
            table.index(['genre_id', 'audio_id'], 'idx_audio_genre_combo')
        })
    }

    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropIndex(['genre_id', 'audio_id'], 'idx_audio_genre_combo')
        })
    }
}
