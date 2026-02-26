import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Database from '@adonisjs/lucid/services/db'
import { faker } from '@faker-js/faker'
import logger from '@adonisjs/core/services/logger'

interface PivotGenre {
  audio_id: number
  genre_id: number
  created_at: Date
  updated_at: Date
}

interface PivotMood {
  audio_id: number
  mood_id: number
  created_at: Date
  updated_at: Date
}

export default class extends BaseSeeder {
  public async run() {
    const BATCH_SIZE = 10000
    const TOTAL = 1_000_000

    logger.info('🚀 Starting Audio Seeding...')

    const existingCount = await Database.from('audio').count('* as total')
    if (existingCount[0].total > 0) {
      logger.info(`⚠️  Database already has ${existingCount[0].total} audio tracks. Skipping...`)
      return
    }

    const genreCount = await Database.from('genres').count('* as total')
    const moodCount = await Database.from('moods').count('* as total')

    const maxGenreId = genreCount[0].total
    const maxMoodId = moodCount[0].total

    logger.info(`📊 Found ${maxGenreId} genres and ${maxMoodId} moods`)

    if (maxGenreId === 0 || maxMoodId === 0) {
      logger.error('❌ Genres or moods missing!')
      logger.error(`   Genres: ${maxGenreId} (need at least 1)`)
      logger.error(`   Moods: ${maxMoodId} (need at least 1)`)
      logger.error('   Please check genre and mood seeders.')
      return
    }

    for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
      try {
        const audios = []

        for (let j = 0; j < BATCH_SIZE && i + j < TOTAL; j++) {
          audios.push({
            seller_id: faker.number.int({ min: 1001, max: 90000 }),
            title: faker.music.songName(),
            slug: faker.string.uuid(),
            cover_image_url: faker.image.url(),
            file_url: faker.internet.url(),
            bpm: faker.number.int({ min: 60, max: 180 }),
            duration: faker.number.int({ min: 60, max: 400 }),
            status: faker.helpers.arrayElement(['pending', 'approve', 'reject']),
            reject_reason: null,
            reviewed_by: faker.number.int({ min: 1, max: 10 }),
            created_at: new Date(),
            reviewed_at: new Date(),
            deleted_at: null,
          })
        }

        await Database.table('audio').multiInsert(audios)

        logger.info(`✅ Inserted ${Math.min(i + BATCH_SIZE, TOTAL)} / ${TOTAL} audio tracks`)

        const audioIds = await Database.from('audio')
          .select('id')
          .orderBy('id', 'desc')
          .limit(audios.length)

        const pivotGenre: PivotGenre[] = []
        const pivotMood: PivotMood[] = []

        for (const audio of audioIds) {
          const genreCountPerAudio = faker.number.int({ min: 1, max: 3 })
          const selectedGenres = new Set<number>()

          while (selectedGenres.size < genreCountPerAudio) {
            selectedGenres.add(faker.number.int({ min: 1, max: maxGenreId }))
          }

          selectedGenres.forEach((genreId) => {
            pivotGenre.push({
              audio_id: audio.id,
              genre_id: genreId,
              created_at: new Date(),
              updated_at: new Date(),
            })
          })

          const moodCountPerAudio = faker.number.int({ min: 1, max: 2 })
          const selectedMoods = new Set<number>()

          while (selectedMoods.size < moodCountPerAudio) {
            selectedMoods.add(faker.number.int({ min: 1, max: maxMoodId }))
          }

          selectedMoods.forEach((moodId) => {
            pivotMood.push({
              audio_id: audio.id,
              mood_id: moodId,
              created_at: new Date(),
              updated_at: new Date(),
            })
          })
        }

        await Database.table('audio_genres').multiInsert(pivotGenre)
        await Database.table('audio_moods').multiInsert(pivotMood)

        logger.info(`✅ Batch ${i / BATCH_SIZE + 1} completed with relations`)
      } catch (error) {
        logger.error(`❌ Failed at batch ${i / BATCH_SIZE + 1}:`, error.message)
        throw error
      }
    }

    const finalAudioCount = await Database.from('audio').count('* as total')
    const finalGenreCount = await Database.from('audio_genres').count('* as total')
    const finalMoodCount = await Database.from('audio_moods').count('* as total')

    logger.info('=====================================')
    logger.info(`✅ Audio Seeding Completed!`)
    logger.info(`   Audio tracks: ${finalAudioCount[0].total}`)
    logger.info(`   Genre relations: ${finalGenreCount[0].total}`)
    logger.info(`   Mood relations: ${finalMoodCount[0].total}`)
    logger.info('=====================================')
  }
}
