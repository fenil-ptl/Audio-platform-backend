import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'payments'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id')
            table.string('payment_intent_id', 255).notNullable().unique()
            table.string('customer_email', 255).nullable()
            table.integer('amount').notNullable() // in cents, e.g. 5000 = $50
            table.string('currency', 10).notNullable()
            table.string('status', 50).notNullable() // succeeded, failed, refunded
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
