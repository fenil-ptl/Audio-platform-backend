import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
    protected tableName = 'genres'

    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('slug').notNullable().alter()
            table.string('name').notNullable().alter()
        })
    }

    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('slug').notNullable().unique().alter()
            table.string('name').notNullable().unique().alter()
        })
    }
}
