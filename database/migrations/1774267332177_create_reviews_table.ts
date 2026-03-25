import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'reviews'

    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id')

            table
                .integer('user_id')
                .unsigned()
                .references('id')
                .inTable('users')
                .onDelete('CASCADE')

            table
                .integer('audio_id')
                .unsigned()
                .references('id')
                .inTable('audio')
                .onDelete('CASCADE')

            table.integer('rating').unsigned().notNullable()

            table.text('comment').nullable()

            table.unique(['user_id', 'audio_id'])

            table.timestamp('created_at', { useTz: true }).defaultTo(this.now())

            table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
        })
    }

    async down() {
        this.schema.dropTable(this.tableName)
    }
}
