import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Database from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

export default class extends BaseSeeder {
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  public async run() {
    logger.info('🚀 Starting Mood Seeding...')

    const existingCount = await Database.from('moods').count('* as total')
    if (existingCount[0].total > 0) {
      logger.info(`⚠️  Database already has ${existingCount[0].total} moods. Skipping...`)
      return
    }

    const moodNames = [
      'Happy',
      'Sad',
      'Energetic',
      'Chill',
      'Dark',
      'Romantic',
      'Melancholic',
      'Uplifting',
      'Aggressive',
      'Peaceful',
      'Mysterious',
      'Dreamy',
      'Tense',
      'Calm',
      'Intense',
      'Playful',
      'Nostalgic',
      'Euphoric',
      'Anxious',
      'Inspirational',
    ]

    const moods = moodNames.map((name) => ({
      name,
      slug: this.slugify(name),
      created_at: new Date(),
      updated_at: new Date(),
    }))

    await Database.table('moods').insert(moods)

    const finalCount = await Database.from('moods').count('* as total')
    logger.info(`✅ Total moods in database: ${finalCount[0].total}`)
    logger.info('✅ Mood Seeding Completed')
  }
}
