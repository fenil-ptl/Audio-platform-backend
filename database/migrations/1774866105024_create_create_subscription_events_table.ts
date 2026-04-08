import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'subscription_events'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id')

            table
                .integer('user_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE')

            table.string('subscription_id', 100).nullable()

            // what happened: created | upgraded | downgraded | canceled_scheduled
            // canceled_immediately | payment_failed | payment_recovered
            // webhook_updated | reactivated
            table.string('event', 60).notNullable()

            table.string('from_status', 40).nullable()
            table.string('to_status', 40).nullable()

            table.string('from_plan', 100).nullable()
            table.string('to_plan', 100).nullable()

            table.string('ip_address', 45).nullable() // 45 chars covers IPv6

            // store raw stripe event type or any extra context
            table.json('metadata').nullable()

            table.timestamp('created_at').notNullable().defaultTo(this.now())

            // indexes for fast lookups — admin dashboard, per-user history
            table.index(['user_id'], 'idx_sub_events_user_id')
            table.index(['subscription_id'], 'idx_sub_events_subscription_id')
            table.index(['event'], 'idx_sub_events_event')
            table.index(['created_at'], 'idx_sub_events_created_at')
        })
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
