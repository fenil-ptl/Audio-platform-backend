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

const audioController = () => import('#controllers/seller_track_controller')
router
    .group(() => {
        router.post('/seller/track', [audioController, 'store']).middleware(createTrackthrottle)

        router.get('/seller/track', [audioController, 'index'])

        router.get('/seller/track/:id', [audioController, 'show'])

        router.patch('/seller/track/:id', [audioController, 'update'])

        router.delete('/seller/track/:id', [audioController, 'destroy'])
    })
    .middleware([middleware.auth(), middleware.role(['seller']), middleware.verifyEmail()])

const adminGenresController = () => import('#controllers/admin/admin_genres_controller')

const adminMoodsController = () => import('#controllers/admin/admin_moods_controller')

const adminTracksController = () => import('#controllers/admin/admin_tracks_controller')
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

const publicController = () => import('#controllers/public_controller')
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

const audioTrackController = () => import('#controllers/audio_tracks_export_controller')
router
    .get('/admin/tracks/export', [audioTrackController, 'export'])
    .middleware([middleware.auth(), middleware.role(['admin']), middleware.verifyEmail()])

const favoritesController = () => import('#controllers/favourites_controller')
const reviewsController = () => import('#controllers/reviews_controller')

// ── Favorites (users only) ──────────────────────────────────────
router
    .group(() => {
        router.post('/favorites/:audioId', [favoritesController, 'toggle'])

        router.get('/favorites', [favoritesController, 'index'])
    })
    .middleware([middleware.auth(), middleware.verifyEmail(), middleware.role(['user'])])

// ── Reviews ─────────────────────────────────────────────────────

router.get('/track/:audioId/reviews', [reviewsController, 'index'])

// Protected: only verified users can write/edit/delete their own
router
    .group(() => {
        router.post('/track/:audioId/reviews', [reviewsController, 'store'])
        router.patch('/reviews/:id', [reviewsController, 'update'])
        router.delete('/reviews/:id', [reviewsController, 'destroy'])
    })
    .middleware([middleware.auth(), middleware.verifyEmail(), middleware.role(['user'])])
