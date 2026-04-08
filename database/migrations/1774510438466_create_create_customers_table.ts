import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'customers'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id')
            table.string('stripe_customer_id', 255).notNullable().unique()
            table.string('email', 255).notNullable()
            table.string('name', 255).nullable()
            table.timestamp('created_at').notNullable()
            table.timestamp('updated_at').notNullable()
        })
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
