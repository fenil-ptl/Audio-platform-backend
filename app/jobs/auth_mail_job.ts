import { Job } from '@rlanz/bull-queue'
import mail from '@adonisjs/mail/services/main'
import router from '@adonisjs/core/services/router'
import env from '#start/env'
import User from '#models/user'
import Logger from '@adonisjs/core/services/logger'

type AuthMailJobData =
    | { type: 'VERIFY_EMAIL'; userId: number }
    | { type: 'RESET_PASSWORD'; userId: number }

export default class AuthMailJob extends Job {
    static $$filepath = new URL(import.meta.url).pathname

    async handle(data: AuthMailJobData) {
        const user = await User.query()
            .where('id', data.userId)
            .select('id', 'fullName', 'email', 'updatedAt')
            .firstOrFail()

        const baseUrl = env.get('APP_URL').replace(/\/$/, '')

        if (data.type === 'VERIFY_EMAIL') {
            const signedUrl = router.makeSignedUrl(
                'auth.verifyEmail',
                { id: user.id },
                { expiresIn: '24h' }
            )

            await mail.send((message) => {
                message.to(user.email).subject('Verify your account').html(`
                    <h2>Welcome ${user.fullName}</h2>
                    <p>Click below to verify your account:</p>
                    <a href="${baseUrl}${signedUrl}">Verify Email</a>
                    <p>This link expires in 24 hours.</p>
                `)
            })
            return
        }

        if (data.type === 'RESET_PASSWORD') {
            const signedUrl = router.makeSignedUrl(
                'auth.resetPassword',
                { id: user.id },
                { expiresIn: '15m' }
            )

            await mail.send((message) => {
                message.to(user.email).subject('Reset your password').html(`
                    <h2>Password Reset</h2>
                    <p>You requested a password reset. Click below:</p>
                    <a href="${baseUrl}${signedUrl}">Reset Password</a>
                    <p>This link expires in 15 minutes.</p>
                `)
            })
            return
        }
    }

    async rescue(data: AuthMailJobData, error: Error) {
        Logger.error(
            {
                jobType: data.type,
                userId: data.userId,
                error: error.message,
            },
            'AuthMailJob exhausted all retry attempts — email not delivered'
        )
    }
}
