import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'subscriptions'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id')
            table.string('stripe_subscription_id', 255).notNullable().unique()
            table.string('stripe_customer_id', 255).notNullable()
            table.string('email', 255).nullable()
            table.string('plan_id', 255).nullable()
            table.string('status', 50).notNullable() // active, canceled, past_due
            table.timestamp('current_period_end').nullable()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
