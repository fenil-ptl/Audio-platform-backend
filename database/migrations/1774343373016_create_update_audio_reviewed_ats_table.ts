import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'audio'

    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('reviewed_at')
        })

        this.schema.alterTable(this.tableName, (table) => {
            table.timestamp('reviewed_at', { useTz: true }).nullable()
        })
    }

    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('reviewed_at')
        })

        // Optional: recreate with old behavior if needed
        // table.timestamp('reviewed_at', { useTz: true }).defaultTo(this.now())
    }
}
