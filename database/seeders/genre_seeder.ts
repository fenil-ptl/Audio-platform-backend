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
    logger.info('🚀 Starting Genre Seeding...') // ✅ Changed from "Mood"

    const existingCount = await Database.from('genres').count('* as total') // ✅ Changed from "moods"
    if (existingCount[0].total > 0) {
      logger.info(`⚠️  Database already has ${existingCount[0].total} genres. Skipping...`) // ✅ Changed from "moods"
      return
    }

    // ✅ GENRE NAMES, not mood names!
    const genreNames = [
      'Pop',
      'Rock',
      'Folk',
      'Electronic',
      'Jazz',
      'Lofi',
      'Ambient',
      'Hip Hop',
      'R&B',
      'Country',
      'Classical',
      'Reggae',
      'Blues',
      'Metal',
      'Indie',
      'Dance',
      'Soul',
      'Funk',
      'Disco',
      'House',
    ]

    const genres = genreNames.map((name) => ({
      name,
      slug: this.slugify(name),
      created_at: new Date(),
      updated_at: new Date(),
    }))

    await Database.table('genres').insert(genres) // ✅ Changed from "moods"

    const finalCount = await Database.from('genres').count('* as total') // ✅ Changed from "moods"
    logger.info(`✅ Total genres in database: ${finalCount[0].total}`) // ✅ Changed from "moods"
    logger.info('✅ Genre Seeding Completed') // ✅ Changed from "Mood"
  }
}
