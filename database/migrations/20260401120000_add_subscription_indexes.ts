import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['stripe_customer_id'], 'subscriptions_stripe_customer_id_idx')
      table.index(['status'], 'subscriptions_status_idx')
      table.index(['user_id'], 'subscriptions_user_id_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['stripe_customer_id'], 'subscriptions_stripe_customer_id_idx')
      table.dropIndex(['status'], 'subscriptions_status_idx')
      table.dropIndex(['user_id'], 'subscriptions_user_id_idx')
    })
  }
}
