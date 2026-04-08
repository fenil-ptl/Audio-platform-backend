import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'subscriptions'

    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .integer('user_id')
                .unsigned()
                .nullable()
                .references('id')
                .inTable('users')
                .onDelete('SET NULL')

            // fast lookup — every subscription check hits this index
            table.index(['user_id', 'status'], 'idx_subscriptions_user_status')
        })
    }

    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropIndex(['user_id', 'status'], 'idx_subscriptions_user_status')
            table.dropColumn('user_id')
        })
    }
}
