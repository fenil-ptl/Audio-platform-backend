import { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import vine from '@vinejs/vine'
import queue from '@rlanz/bull-queue/services/main'
import User from '#models/user'
import AuthMailJob from '#jobs/auth_mail_job'
import db from '@adonisjs/lucid/services/db'

export default class AuthController {
    async register({ request, i18n }: HttpContext) {
        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    fullName: vine.string().trim().minLength(3).maxLength(100),
                    email: vine.string().email().normalizeEmail(),
                    password: vine
                        .string()
                        .minLength(8)
                        .maxLength(64)
                        .regex(/[A-Z]/)
                        .regex(/[a-z]/)
                        .regex(/[0-9]/)
                        .regex(/[@$!%*?&]/),
                    role: vine.enum(['seller', 'user'] as const),
                })
            )
        )

        try {
            const user = await User.create({ ...payload, isEmailVerified: false })

            queue.dispatch(AuthMailJob, { type: 'VERIFY_EMAIL', userId: user.id })

            return {
                success: true,
                message: i18n.t('message.auth.register_success'),
                data: null,
            }
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Exception(i18n.t('message.auth.email_registered'), { status: 409 })
            }
            throw error
        }
    }

    async verifyEmail({ request, i18n }: HttpContext) {
        if (!request.hasValidSignature()) {
            throw new Exception(i18n.t('message.auth.link_expired'), { status: 400 })
        }

        const id = Number(request.param('id'))
        if (!Number.isInteger(id) || id < 1) {
            throw new Exception(i18n.t('message.auth.link_expired'), { status: 400 })
        }

        const user = await User.query()
            .where('id', id)
            .select('id', 'is_email_verify')
            .firstOrFail()

        if (user.isEmailVerified) {
            throw new Exception(i18n.t('message.auth.email_already_verified'), { status: 400 })
        }

        user.isEmailVerified = true
        await user.save()

        return {
            success: true,
            message: i18n.t('message.auth.email_verified'),
            data: null,
        }
    }

    async login({ request, i18n }: HttpContext) {
        const { email, password } = await request.validateUsing(
            vine.compile(
                vine.object({
                    email: vine.string().email().normalizeEmail(),
                    password: vine.string().minLength(8).maxLength(64),
                })
            )
        )

        const user = await User.verifyCredentials(email, password)

        const token = await User.accessTokens.create(user, ['*'], {
            expiresIn: '1d',
        })

        return {
            success: true,
            message: i18n.t('message.auth.login_success'),
            data: {
                token: token.value!.release(),
            },
        }
    }

    async logout({ auth, i18n }: HttpContext) {
        const user = auth.user!
        const token = user.currentAccessToken

        if (!token) {
            throw new Exception(i18n.t('message.auth.no_session'), { status: 400 })
        }

        await User.accessTokens.delete(user, token.identifier)

        return {
            success: true,
            message: i18n.t('message.auth.logout_success'),
            data: null,
        }
    }

    async me({ auth, i18n }: HttpContext) {
        const user = auth.user!

        return {
            success: true,
            message: i18n.t('message.auth.profile_fetch'),
            data: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
            },
        }
    }

    async forgotPassword({ request, i18n }: HttpContext) {
        const { email } = await request.validateUsing(
            vine.compile(
                vine.object({
                    email: vine.string().email().normalizeEmail(),
                })
            )
        )

        const user = await User.query().where('email', email).select('id').first()

        if (user) {
            queue.dispatch(AuthMailJob, { type: 'RESET_PASSWORD', userId: user.id })
        }

        return {
            success: true,
            message: i18n.t('message.auth.forgot_password_sent'),
            data: null,
        }
    }

    async resetPassword({ request, i18n }: HttpContext) {
        if (!request.hasValidSignature()) {
            throw new Exception(i18n.t('message.auth.reset_link_expired'), { status: 400 })
        }

        const { password } = await request.validateUsing(
            vine.compile(
                vine.object({
                    password: vine
                        .string()
                        .minLength(8)
                        .maxLength(64)
                        .regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[@$!%*?&])/),
                })
            )
        )

        const id = Number(request.param('id'))
        if (!Number.isInteger(id) || id < 1) {
            throw new Exception(i18n.t('message.auth.reset_link_expired'), { status: 400 })
        }

        await db.transaction(async (trx) => {
            const user = await User.query({ client: trx })
                .where('id', id)
                .select('id', 'password')
                .firstOrFail()

            user.password = password
            await user.save()

            await trx.from('auth_access_tokens').where('tokenable_id', user.id).delete()
        })

        return {
            success: true,
            message: i18n.t('message.auth.reset_success'),
            data: null,
        }
    }

    async resendVerificationEmail({ request, i18n }: HttpContext) {
        const { email } = await request.validateUsing(
            vine.compile(
                vine.object({
                    email: vine.string().email().normalizeEmail(),
                })
            )
        )

        const user = await User.query()
            .where('email', email)
            .select('id', 'is_email_verified')
            .first()

        if (!user || user.isEmailVerified) {
            return {
                success: true,
                message: i18n.t('message.auth.resend_success'),
                data: null,
            }
        }

        queue.dispatch(AuthMailJob, { type: 'VERIFY_EMAIL', userId: user.id })

        return {
            success: true,
            message: i18n.t('message.auth.resend_success'),
            data: null,
        }
    }
}
