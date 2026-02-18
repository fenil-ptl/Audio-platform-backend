/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router.get('/home', async () => {
  return {
    title: 'home page',
  }
})

const authRegisterController = () => import('#controllers/auth_controller')
router.post('/auth/register', [authRegisterController, 'register'])
router.get('/auth/register/verify-email', [authRegisterController, 'verifyEmail'])

router.post('/auth/login', [authRegisterController, 'login'])

router.post('/auth/forget-password', [authRegisterController, 'forgetPassword'])
router.post('/auth/forget-password/reset-password', [authRegisterController, 'resetPassword'])
router.post('/auth/logout', [authRegisterController, 'logout']).use(middleware.auth())
router.post('/auth/profile', [authRegisterController, 'me']).use(middleware.auth())
router.post('/auth/resend-verification', [authRegisterController, 'resendVerificationEmail'])

const audioController = () => import('#controllers/audio_controller')

router
  .group(() => {
    // seller ONLY
    router.post('/seller/tracks', [audioController, 'store']).use(middleware.role(['seller']))

    // SELLER only
    router.get('/seller/tracks', [audioController, 'index']).use(middleware.role(['seller']))

    router.get('/seller/tracks/:id', [audioController, 'show']).use(middleware.role(['seller']))
  })
  .use(middleware.auth())

router
  .group(() => {
    // admin ONLY

    // admin only
    router
      .get('/admin/tracks/pending', [audioController, 'pendingTracks'])
      .use(middleware.role(['admin']))

    router
      .patch('/admin/tracks/:id/approve', [audioController, 'approveTrack'])
      .use(middleware.role(['admin']))

    // router
    //   .patch('/admin/tracks/:id/rejected', [audioController, 'index'])
    //   .use(middleware.role(['admin']))

    // router.patch('/admin/genres', [audioController, 'index']).use(middleware.role(['admin']))

    // router.patch('/admin/moods', [audioController, 'index']).use(middleware.role(['admin']))
  })
  .use(middleware.auth())
