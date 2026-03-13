import { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import queue from '@rlanz/bull-queue/services/main'
import User from '#models/user'
import AuthMailJob from '#jobs/auth_mail_job'

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
                    role: vine.enum(['seller', 'admin', 'user'] as const),
                })
            )
        )

        const existing = await User.query().where('email', payload.email).select('id').first()

        if (existing) {
            throw new Exception(i18n.t('messages.auth.email_registered'), { status: 409 })
        }

        const user = await User.create({ ...payload, isEmailVerified: false })

        await queue.dispatch(AuthMailJob, { type: 'VERIFY_EMAIL', userId: user.id })

        return {
            message: i18n.t('messages.auth.register_success'),
        }
    }

    async verifyEmail({ request, i18n }: HttpContext) {
        if (!request.hasValidSignature()) {
            throw new Exception(i18n.t('messages.auth.link_expired'), { status: 400 })
        }

        const user = await User.query()
            .where('id', request.param('id'))
            .select('id', 'isEmailVerified')
            .firstOrFail()

        if (user.isEmailVerified) {
            throw new Exception(i18n.t('messages.auth.email_already_verified'), { status: 400 })
        }

        user.isEmailVerified = true
        await user.save()

        return {
            message: i18n.t('messages.auth.email_verified'),
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

        const user = await User.query()
            .where('email', email)
            .select('id', 'fullName', 'email', 'password', 'role', 'isEmailVerified')
            .first()

        if (!user || !(await hash.verify(user.password, password))) {
            throw new Exception(i18n.t('messages.auth.invalid_credentials'), { status: 401 })
        }

        if (!user.isEmailVerified) {
            throw new Exception(i18n.t('messages.auth.email_not_verified'), {
                status: 403,
                code: 'EMAIL_NOT_VERIFIED',
            })
        }

        const token = await User.accessTokens.create(user)

        return {
            message: i18n.t('messages.auth.login_success'),
            user: user.serialize(),
            token: {
                type: 'bearer',
                value: token.value!.release(),
            },
        }
    }

    async logout({ auth, i18n }: HttpContext) {
        const user = auth.user!
        const token = user.currentAccessToken

        if (!token) {
            throw new Exception(i18n.t('messages.auth.no_session'), { status: 400 })
        }

        await User.accessTokens.delete(user, token.identifier)

        return {
            message: i18n.t('messages.auth.logout_success'),
        }
    }

    async me({ auth }: HttpContext) {
        return { user: auth.user!.serialize() }
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
            await queue.dispatch(AuthMailJob, { type: 'RESET_PASSWORD', userId: user.id })
        }

        return {
            message: i18n.t('messages.auth.forgot_password_sent'),
        }
    }

    async resetPassword({ request, i18n }: HttpContext) {
        if (!request.hasValidSignature()) {
            throw new Exception(i18n.t('messages.auth.reset_link_expired'), { status: 400 })
        }

        const { password } = await request.validateUsing(
            vine.compile(
                vine.object({
                    password: vine
                        .string()
                        .minLength(8)
                        .maxLength(64)
                        .regex(/[A-Z]/)
                        .regex(/[a-z]/)
                        .regex(/[0-9]/)
                        .regex(/[@$!%*?&]/),
                })
            )
        )

        const user = await User.query()
            .where('id', request.param('id'))
            .select('id', 'password')
            .firstOrFail()

        user.password = password
        await user.save()

        const tokens = await User.accessTokens.all(user)
        await Promise.all(tokens.map((t) => User.accessTokens.delete(user, t.identifier)))

        return {
            message: i18n.t('messages.auth.reset_success'),
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
            .select('id', 'isEmailVerified')
            .first()

        if (!user || user.isEmailVerified) {
            return {
                message: i18n.t('messages.auth.forgot_password_sent'),
            }
        }

        await queue.dispatch(AuthMailJob, { type: 'VERIFY_EMAIL', userId: user.id })

        return {
            message: i18n.t('messages.auth.resend_success'),
        }
    }
}
