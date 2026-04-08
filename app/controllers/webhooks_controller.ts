import type { HttpContext } from '@adonisjs/core/http'
import StripeService from '#services/stripe_service'
import env from '#start/env'

const stripeService = new StripeService()

export default class WebhooksController {
    async handle({ request, response }: HttpContext) {
        const signature = request.header('stripe-signature')
        if (!signature) {
            return response.badRequest({ error: 'Missing stripe-signature header' })
        }

        const raw = request.raw()

        if (!raw) {
            return response.badRequest({ error: 'Missing raw body' })
        }

        const rawBody = Buffer.from(raw)

        let event

        try {
            event = stripeService.constructWebhookEvent(
                rawBody,
                signature,
                env.get('STRIPE_WEBHOOK_SECRET')
            )
        } catch (err: any) {
            return response.badRequest({ error: err.message })
        }

        await stripeService.handleWebhookEvent(event)

        return response.ok({ received: true })
    }
}
