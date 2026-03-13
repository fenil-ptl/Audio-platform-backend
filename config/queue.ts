import { defineConfig } from '@rlanz/bull-queue'
import env from '#start/env'

export default defineConfig({
    defaultConnection: {
        host: env.get('QUEUE_REDIS_HOST'),
        port: env.get('QUEUE_REDIS_PORT'),
        // Don't pass password key at all if empty — BullMQ treats
        // empty string as a password attempt which Redis rejects
        ...(env.get('QUEUE_REDIS_PASSWORD') ? { password: env.get('QUEUE_REDIS_PASSWORD') } : {}),
    },
    queue: {
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        },
    },
    worker: {},
    jobs: {},
})
