// app/middleware/role_middleware.ts
import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'

export default class RoleMiddleware {
    /**
     * @param allowedRoles - Passed from the routes file (e.g. ['admin', 'seller'])
     */
    async handle(ctx: HttpContext, next: NextFn, allowedRoles: string[]) {
        // 1. Get user from auth (must run after auth middleware)
        const user = ctx.auth.user as User

        // 2. If user doesn't exist or role isn't in the allowed list, block them
        if (!user || !allowedRoles.includes(user.role)) {
            return ctx.response.forbidden({
                message: 'Access Denied: You do not have the required permissions.',
            })
        }

        // 3. Proceed to the next step
        return next()
    }
}

/*



*/
