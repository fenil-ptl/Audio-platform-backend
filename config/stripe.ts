import env from '#start/env'
import { StripeService as AdonisStripeService } from 'adonis-stripe-package'

const stripe = new AdonisStripeService(
    env.get('STRIPE_SECRET_KEY'),
    {
        // Cast to satisfy Stripe typings while allowing a stable GA version override via env.
        apiVersion: env.get('STRIPE_API_VERSION', '2023-10-16') as any,
    }
).client

export default stripe
