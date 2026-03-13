/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import limiter from '@adonisjs/limiter/services/main'

export const throttle = limiter.define('global', () => {
    return limiter.allowRequests(10).every('1 minute')
})
export const loginthrottle = limiter.define('login', () => {
    return limiter.allowRequests(5).every('15 minute')
})
export const registerthrottle = limiter.define('register', () => {
    return limiter.allowRequests(5).every('15 minute')
})
export const exportthrottle = limiter.define('export', () => {
    return limiter.allowRequests(5).every('15 minute')
})
export const forgetPasswordthrottle = limiter.define('forget-password', () => {
    return limiter.allowRequests(5).every('15 minute')
})
export const resetPasswordthrottle = limiter.define('forget-password', () => {
    return limiter.allowRequests(5).every('15 minute')
})
export const resendVerificationthrottle = limiter.define('resend-verification', () => {
    return limiter.allowRequests(5).every('15 minute')
})
export const createTrackthrottle = limiter.define('create-track', () => {
    return limiter.allowRequests(5).every('15 minute')
})
export const publicthrottle = limiter.define('public', () => {
    return limiter.allowRequests(5).every('15 minute')
})
