import { ExceptionHandler, HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

type StripeLikeError = {
    message: string
    statusCode?: number
    type?: string
    code?: string
    rawType?: string
}

export default class HttpExceptionHandler extends ExceptionHandler {
    protected debug = !app.inProduction

    private isStripeLikeError(error: unknown): error is StripeLikeError {
        if (!error || typeof error !== 'object') return false

        const candidate = error as Partial<StripeLikeError>
        return (
            typeof candidate.message === 'string' &&
            (typeof candidate.type === 'string' || typeof candidate.rawType === 'string')
        )
    }

    async handle(error: unknown, ctx: HttpContext) {
        // Handle Stripe-specific errors cleanly
        if (this.isStripeLikeError(error)) {
            return ctx.response.status(error.statusCode ?? 400).json({
                error: error.message,
                type: error.type ?? error.rawType,
                code: error.code,
            })
        }

        return super.handle(error, ctx)
    }

    async report(error: unknown, ctx: HttpContext) {
        return super.report(error, ctx)
    }
}
