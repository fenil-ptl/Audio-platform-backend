import { BaseSeeder } from '@adonisjs/lucid/seeders'
import UserSeeder from './user_seeder.js'
import GenreSeeder from './genre_seeder.js'
import MoodSeeder from './mood_seeder.js'
import AudioSeeder from './audio_seeder.js'

export default class DatabaseSeeder extends BaseSeeder {
    public async run() {
        try {
            await new UserSeeder(this.client).run()

            await new GenreSeeder(this.client).run()

            await new MoodSeeder(this.client).run()

            await new AudioSeeder(this.client).run()
        } catch (error) {
            throw error
        }
    }
}
