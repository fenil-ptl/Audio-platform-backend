import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class VerifyEmailMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        const user = ctx.auth.user

        if (!user) {
            return ctx.response.unauthorized({ message: 'not authenticated ' })
        }
        if (!user.isEmailVerified) {
            return ctx.response.unauthorized({ message: 'please verify email from middleware' })
        }

        const output = await next()
        return output
    }
}
