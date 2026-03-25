import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

const corsConfig = defineConfig({
    enabled: true,

    origin:
        env.get('NODE_ENV') === 'production'
            ? ['https://yourdomain.com', 'https://www.yourdomain.com', 'https://app.yourdomain.com']
            : [
                  'http://localhost:3000', // React / Vue dev server
                  'http://localhost:5173', // Vite dev server
                  'http://localhost:4200', // Angular dev server
                  'http://127.0.0.1:3000',
              ],

    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    headers: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'X-CSRF-Token',
    ],

    exposeHeaders: ['Content-Range', 'X-Total-Count', 'Authorization'],

    credentials: true,

    maxAge: 600,
})

export default corsConfig
