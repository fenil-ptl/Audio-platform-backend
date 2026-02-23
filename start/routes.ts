import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const authRegisterController = () => import('#controllers/auth_controller')

router
  .group(() => {
    router.post('/register', [authRegisterController, 'register'])
    router
      .get('/register/verify-email/:id', [authRegisterController, 'verifyEmail'])
      .as('verifyEmail')
    router.post('/login', [authRegisterController, 'login'])

    router.post('/forget-password', [authRegisterController, 'forgetPassword'])

    router.post('/forget-password/reset-password', [authRegisterController, 'resetPassword'])

    router
      .post('/logout', [authRegisterController, 'logout'])
      .middleware([middleware.auth(), middleware.verifyEmail()])

    router
      .post('/profile', [authRegisterController, 'me'])
      .middleware([middleware.auth(), middleware.verifyEmail()])

    router.post('/resend-verification', [authRegisterController, 'resendVerificationEmail'])
  })
  .prefix('/auth')

//seller routes
const audioController = () => import('#controllers/audio_controller')
router
  .group(() => {
    router.post('/', [audioController, 'store'])
    router.get('/', [audioController, 'index'])
    router.get('/:id', [audioController, 'show'])
  })
  .prefix('/seller/tracks')
  .middleware([middleware.auth(), middleware.role(['seller']), middleware.verifyEmail()])

//admin routes
router
  .group(() => {
    router.get('/tracks/pending', [audioController, 'pendingTracks'])
    router.patch('/tracks/:id/approve', [audioController, 'approveTrack'])
    router.patch('/tracks/:id/rejected', [audioController, 'rejectTrack'])
    router.post('/genres', [audioController, 'genres'])
    router.post('/moods', [audioController, 'mood'])
    router.patch('/genres/:id', [audioController, 'editGenres'])
    router.delete('/genres/:id', [audioController, 'deleteGenre'])
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
      .middleware([middleware.auth(), middleware.role(['user']), middleware.verifyEmail()])
  })
  .prefix('/track')

const audioTrackController = () => import('#controllers/audio_tracks_controller')
router
  .get('/admin/tracks/export', [audioTrackController, 'export'])
  .middleware([middleware.auth(), middleware.role(['admin']), middleware.verifyEmail()])
