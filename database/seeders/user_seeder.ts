import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Database from '@adonisjs/lucid/services/db'
import { faker } from '@faker-js/faker'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'

export default class extends BaseSeeder {
  public async run() {
    const BATCH_SIZE = 5000
    const TARGET_TOTAL = 1_000_000 // ✅ Target: 1 million users
    const TOTAL_ADMINS = 1000
    const TOTAL_SELLERS = 89000

    logger.info('🚀 Starting User Seeding...')

    // ✅ Check how many users already exist
    const existingCount = await Database.from('users').count('* as total')
    const currentTotal = existingCount[0].total

    logger.info(`📊 Current users in database: ${currentTotal}`)

    if (currentTotal >= TARGET_TOTAL) {
      logger.info(`⚠️  Already have ${currentTotal} users. Target is ${TARGET_TOTAL}. Skipping...`)
      return
    }

    // ✅ Calculate how many MORE users we need to create
    const usersToCreate = TARGET_TOTAL - currentTotal
    logger.info(`📊 Need to create ${usersToCreate} more users`)

    // ✅ Get the highest existing ID to continue from there
    const maxIdResult = await Database.from('users').max('id as maxId')
    const startingIndex = maxIdResult[0].maxId || 0

    logger.info(`📊 Starting from ID: ${startingIndex + 1}`)

    const hashedPassword = await hash.make('password123')

    for (let i = 0; i < usersToCreate; i += BATCH_SIZE) {
      const users = []

      for (let j = 0; j < BATCH_SIZE && i + j < usersToCreate; j++) {
        const globalIndex = startingIndex + i + j

        // Determine role based on TOTAL index (including existing users)
        let role: 'admin' | 'seller' | 'user'
        if (globalIndex < TOTAL_ADMINS) {
          role = 'admin'
        } else if (globalIndex < TOTAL_ADMINS + TOTAL_SELLERS) {
          role = 'seller'
        } else {
          role = 'user'
        }

        users.push({
          full_name: faker.person.fullName(),
          email: `user${globalIndex + 1}@example.com`,
          password: hashedPassword,
          role: role,
          is_email_verify: false,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }

      await Database.table('users').multiInsert(users)
      logger.info(
        `✅ Inserted ${Math.min(i + BATCH_SIZE, usersToCreate)} / ${usersToCreate} new users`
      )
    }

    const finalCount = await Database.from('users').count('* as total')
    const adminCount = await Database.from('users').where('role', 'admin').count('* as total')
    const sellerCount = await Database.from('users').where('role', 'seller').count('* as total')
    const userCount = await Database.from('users').where('role', 'user').count('* as total')

    logger.info('=====================================')
    logger.info(`✅ User Seeding Completed!`)
    logger.info(`   Total: ${finalCount[0].total}`)
    logger.info(`   Admins: ${adminCount[0].total}`)
    logger.info(`   Sellers: ${sellerCount[0].total}`)
    logger.info(`   Regular Users: ${userCount[0].total}`)
    logger.info('=====================================')
  }
}
