import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import {
    createTrackthrottle,
    forgetPasswordthrottle,
    registerthrottle,
    loginthrottle,
    publicthrottle,
    publicListthrottle,
    resendEmailthrottle,
} from './limiter.js'

const AuthController = () => import('#controllers/auth_controller')
const PaymentsController = () => import('#controllers/payments_controller')
const SubscriptionsController = () => import('#controllers/subscriptions_controller')
const WebhooksController = () => import('#controllers/webhooks_controller')
const favoritesController = () => import('#controllers/favourites_controller')
const reviewsController = () => import('#controllers/reviews_controller')
const publicController = () => import('#controllers/public_controller')
const adminGenresController = () => import('#controllers/admin/admin_genres_controller')
const adminMoodsController = () => import('#controllers/admin/admin_moods_controller')
const adminTracksController = () => import('#controllers/admin/admin_tracks_controller')
const audioController = () => import('#controllers/seller_track_controller')
const audioTrackController = () => import('#controllers/audio_tracks_export_controller')

router.group(() => {
    router.post('/auth/register', [AuthController, 'register']).middleware(registerthrottle)

    router.get('/auth/verify-email/:id', [AuthController, 'verifyEmail']).as('auth.verifyEmail')

    router.post('/auth/login', [AuthController, 'login']).middleware(loginthrottle).as('auth.login')

    router.post('/auth/logout', [AuthController, 'logout']).middleware(middleware.auth())

    router.get('/auth/me', [AuthController, 'me']).middleware([middleware.auth()])

    router
        .post('/auth/forgot-password', [AuthController, 'forgotPassword'])
        .middleware(forgetPasswordthrottle)

    router
        .post('/auth/reset-password/:id', [AuthController, 'resetPassword'])
        .as('auth.resetPassword')

    router
        .post('/auth/resend-verification', [AuthController, 'resendVerificationEmail'])
        .middleware(resendEmailthrottle)
})

router
    .group(() => {
        router
            .post('/seller/track', [audioController, 'store'])
            .middleware([middleware.checkSubscription(), createTrackthrottle])

        router.get('/seller/track', [audioController, 'index'])

        router.get('/seller/track/:id', [audioController, 'show'])

        router.patch('/seller/track/:id', [audioController, 'update'])

        router.delete('/seller/track/:id', [audioController, 'destroy'])
    })
    .middleware([middleware.auth(), middleware.role(['seller'])])

router
    .group(() => {
        router.get('/admin/tracks/pending', [adminTracksController, 'pendingTracks'])

        router.patch('/admin/tracks/:id/approve', [adminTracksController, 'approveTrack'])

        router.patch('/admin/tracks/:id/rejected', [adminTracksController, 'rejectTrack'])

        router.post('/admin/genres', [adminGenresController, 'createGenres'])

        router.patch('/admin/genres/:id', [adminGenresController, 'editGenres'])

        router.delete('/admin/genres/:id', [adminGenresController, 'deleteGenre'])

        router.post('/admin/moods', [adminMoodsController, 'createMood'])

        router.patch('/admin/moods/:id', [adminMoodsController, 'editMood'])

        router.delete('/admin/moods/:id', [adminMoodsController, 'deleteMood'])
    })
    .middleware([middleware.auth(), middleware.verifyEmail(), middleware.role(['admin'])])

router.group(() => {
    router.get('/track', [publicController, 'index']).middleware(publicListthrottle)

    router
        .get('/track/genres/:genreName', [publicController, 'getByGenre'])
        .middleware(publicListthrottle)

    router
        .get('/track/moods/:moodName', [publicController, 'getByMood'])
        .middleware(publicListthrottle)

    router
        .get('/track/:id', [publicController, 'show'])
        .middleware([middleware.role(['user']), publicthrottle])
})

router
    .get('/admin/tracks/export', [audioTrackController, 'export'])
    .middleware([middleware.auth(), middleware.role(['admin']), middleware.verifyEmail()])

router
    .group(() => {
        router.post('/favorites/:audioId', [favoritesController, 'toggle'])

        router.get('/favorites', [favoritesController, 'index'])
    })
    .middleware([middleware.auth(), middleware.verifyEmail(), middleware.role(['user'])])

router.get('/track/:audioId/reviews', [reviewsController, 'index'])

router
    .group(() => {
        router.post('/track/:audioId/reviews', [reviewsController, 'store'])
        router.patch('/reviews/:id', [reviewsController, 'update'])
        router.delete('/reviews/:id', [reviewsController, 'destroy'])
    })
    .middleware([middleware.auth(), middleware.verifyEmail(), middleware.role(['user'])])

router.post('/webhook', [WebhooksController, 'handle'])

router.get('/success', [PaymentsController, 'success'])

router
    .group(() => {
        router.post('/intent', [PaymentsController, 'createIntent'])

        router.post('/checkout', [PaymentsController, 'checkoutSession'])

        router.get('/status/:paymentIntentId', [PaymentsController, 'status'])

        router.post('/refund', [PaymentsController, 'refund'])

        router.get('/', [PaymentsController, 'list'])
    })
    .prefix('/api/payments')
    .middleware(middleware.auth())

router
    .group(() => {
        router
            .post('/customers', [SubscriptionsController, 'createCustomer'])
            .middleware(middleware.auth())

        router.post('/', [SubscriptionsController, 'create']).middleware(middleware.auth())

        router.get('/me', [SubscriptionsController, 'me']).middleware(middleware.auth())

        router.get('/health', [SubscriptionsController, 'health']).middleware(middleware.auth())

        router
            .get('/billing/portal', [SubscriptionsController, 'billingPortal'])
            .middleware(middleware.auth())

        router
            .delete('/:subscriptionId', [SubscriptionsController, 'cancel'])
            .middleware(middleware.auth())

        router
            .get('/:subscriptionId', [SubscriptionsController, 'show'])
            .middleware(middleware.auth())

        router
            .patch('/:subscriptionId/upgrade', [SubscriptionsController, 'upgrade'])
            .middleware(middleware.auth())
    })
    .prefix('/api/subscriptions')
