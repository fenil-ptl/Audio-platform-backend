import { BaseSeeder } from '@adonisjs/lucid/seeders'
import UserSeeder from './user_seeder.js'
import GenreSeeder from './genre_seeder.js'
import MoodSeeder from './mood_seeder.js'
import AudioSeeder from './audio_seeder.js'

export default class DatabaseSeeder extends BaseSeeder {
    public async run() {
        console.log('===============================================')
        console.log('🚀 DATABASE SEEDER STARTED')
        console.log('===============================================')

        try {
            console.log('▶️  Running UserSeeder...')
            await new UserSeeder(this.client).run()
            console.log('✅ UserSeeder completed')

            console.log('▶️  Running GenreSeeder...')
            await new GenreSeeder(this.client).run()
            console.log('✅ GenreSeeder completed')

            console.log('▶️  Running MoodSeeder...')
            await new MoodSeeder(this.client).run()
            console.log('✅ MoodSeeder completed')

            console.log('▶️  Running AudioSeeder...')
            await new AudioSeeder(this.client).run()
            console.log('✅ AudioSeeder completed')

            console.log('===============================================')
            console.log('✅ ALL SEEDERS COMPLETED SUCCESSFULLY')
            console.log('===============================================')
        } catch (error) {
            console.error('===============================================')
            console.error('❌ SEEDER FAILED WITH ERROR:')
            console.error('===============================================')
            console.error(error)
            throw error
        }
    }
}
