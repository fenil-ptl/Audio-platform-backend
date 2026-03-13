import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
    connection: 'mysql',
    connections: {
        mysql: {
            client: 'mysql2',
            connection: {
                host: env.get('DB_HOST'),
                port: env.get('DB_PORT'),
                user: env.get('DB_USER'),
                password: env.get('DB_PASSWORD'),
                database: env.get('DB_DATABASE'),
            },

            pool: {
                min: 2,
                max: 20,
                acquireTimeoutMillis: 30_000,
                idleTimeoutMillis: 600_000,
            },

            debug: env.get('NODE_ENV') === 'development',

            useNullAsDefault: true,

            migrations: {
                naturalSort: true,
                paths: ['database/migrations'],
            },
        },
    },
})

export default dbConfig
