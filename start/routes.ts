import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import {
  // createTrackthrottle,
  exportthrottle,
  forgetPasswordthrottle,
  loginthrottle,
  publicthrottle,
  registerthrottle,
  resendVerificationthrottle,
  resetPasswordthrottle,
} from './limiter.js'

const authRegisterController = () => import('#controllers/auth_controller')

router
  .group(() => {
    router.post('/register', [authRegisterController, 'register']).middleware(registerthrottle)
    router
      .get('/register/verify-email/:id', [authRegisterController, 'verifyEmail'])
      .as('verifyEmail')
    router.post('/login', [authRegisterController, 'login']).middleware(loginthrottle)

    router
      .post('/forget-password', [authRegisterController, 'forgetPassword'])
      .middleware(forgetPasswordthrottle)

    router
      .post('/forget-password/reset-password/:id', [authRegisterController, 'resetPassword'])
      .as('resetPassword')
      .middleware(resetPasswordthrottle)

    router
      .post('/logout', [authRegisterController, 'logout'])
      .middleware([middleware.auth(), middleware.verifyEmail()])

    router
      .post('/profile', [authRegisterController, 'me'])
      .middleware([middleware.auth(), middleware.verifyEmail()])

    router
      .post('/resend-verification', [authRegisterController, 'resendVerificationEmail'])
      .middleware(resendVerificationthrottle)
  })
  .prefix('/auth')

//seller routes
const audioController = () => import('#controllers/audio_controller')
router
  .group(() => {
    router.post('/', [audioController, 'store']) //.middleware(createTrackthrottle)
    router.get('/', [audioController, 'index'])
    router.get('/:id', [audioController, 'show'])
  })
  .prefix('/seller/tracks')
  .middleware([middleware.auth(), middleware.role(['seller']), middleware.verifyEmail()])

router
  .group(() => {
    router.get('/tracks/pending', [audioController, 'pendingTracks'])
    router.patch('/tracks/:id/approve', [audioController, 'approveTrack'])
    router.patch('/tracks/:id/rejected', [audioController, 'rejectTrack'])
    router.post('/genres', [audioController, 'createGenres'])
    router.patch('/genres/:id', [audioController, 'editGenres'])
    router.delete('/genres/:id', [audioController, 'deleteGenre'])
    router.post('/moods', [audioController, 'createMood'])
    router.patch('/moods/:id', [audioController, 'editMood'])
    router.delete('/moods/:id', [audioController, 'deleteMood'])
  })
  .prefix('/admin')
  .middleware([middleware.auth(), middleware.verifyEmail(), middleware.role(['admin'])])

const publicController = () => import('#controllers/public_controller')
router
  .group(() => {
    router.get('/', [publicController, 'index'])
    router
      .get('/:id', [publicController, 'show'])
      .middleware([
        middleware.auth(),
        middleware.role(['user']),
        middleware.verifyEmail(),
        publicthrottle,
      ])
  })
  .prefix('/track')

const audioTrackController = () => import('#controllers/audio_tracks_controller')
router
  .get('/admin/tracks/export', [audioTrackController, 'export'])
  .middleware([
    middleware.auth(),
    middleware.role(['admin']),
    middleware.verifyEmail(),
    exportthrottle,
  ])
