// config/auth.ts
import { defineConfig } from '@adonisjs/auth'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'

const authConfig = defineConfig({
    default: 'api',
    guards: {
        api: tokensGuard({
            provider: tokensUserProvider({
                tokens: 'accessTokens', // Must match the static property in User model
                model: () => import('#models/user'),
            }),
        }),
    },
})

export default authConfig
declare module '@adonisjs/auth/types' {
    interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
