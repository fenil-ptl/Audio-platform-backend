import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import { HttpContext } from '@adonisjs/core/http'
import router from '@adonisjs/core/services/router'

export default class AuthService {
  static async register(data: {
    fullName: string
    email: string
    password: string
    role: 'admin' | 'seller' | 'user'
  }) {
    const existingUser = await User.findBy('email', data.email)
    if (existingUser) {
      throw new Error('EMAIL_ALREADY_EXISTS')
    }

    const user = await User.create({
      ...data,
      isEmailVerified: false,
    })

    const verificationUrl = await this.sendVerificationEmail(user)

    return { user, verificationUrl }
  }

  static async sendVerificationEmail(user: User) {
    // Clear any existing tokens for this user

    const signedUrl = router.makeSignedUrl(
      'verifyEmail',
      { id: user.id },
      {
        expiresIn: '24h',
      }
    )
    console.log('sign url=', signedUrl)

    mail.send((message) => {
      message.to(user.email).subject('Verify your account').html(`
          <h2>Welcome ${user.fullName}</h2>
          <p>Click below to verify your account:</p>
          <a href="http://localhost:3333${signedUrl}">
            Verify Email
          </a>
        `)
    })
    return signedUrl
  }

  static async verifyEmail(request: HttpContext['request']) {
    if (!request.hasValidSignature()) {
      throw new Error(' Invalid or Expire Link ')
    }

    const userId = request.param('id')

    // const userId = request.input('id')
    console.log('userID=', userId)

    const user = await User.findOrFail(userId)

    user.isEmailVerified = true
    await user.save()
  }

  static async verifyCredentials(email: string, password: string) {
    const user = await User.findBy('email', email)

    if (!user) {
      throw new Error('INVALID_CREDENTIALS')
    }

    const isValid = await hash.verify(user.password, password)
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS')
    }

    if (!user.isEmailVerified) {
      throw new Error('please verify email')
    }

    return user
  }

  static async generateToken(user: User) {
    return await User.accessTokens.create(user)
  }

  static async invalidateToken(user: User, tokenId: string) {
    await User.accessTokens.delete(user, tokenId)
  }

    static async sendResetEmail(email: string) {
      const user = await User.findBy('email', email)

      if (!user) {
        return `no user found check again `
      }
      const signedUrl = router.makeSignedUrl(
        'resetPassword',
        { id: user.id },
        {
          expiresIn: '15m',
        }
      )

      console.log('sign url=', signedUrl)

      mail.send((message) => {
        message.to(user.email).subject('Reset your password').html(`
            <h2>Password Reset</h2>
            <p>You requested a password reset. Click the link below:</p>
            <a href="http://localhost:3333${signedUrl}">
              Reset Password
            </a>
          `)
      })

      return signedUrl
    }

  static async resendVerificationEmail(email: string) {
    const user = await User.findBy('email', email)

    if (!user) {
      throw new Error('USER_NOT_FOUND')
    }
    if (user.isEmailVerified) {
      throw new Error('EMAIL_IS_ALREADY_VERIFIED')
    }

    const url = await this.sendVerificationEmail(user)
    return url
  }

  static async resetPassword(request: HttpContext['request'], newPassword: string) {
    if (!request.hasValidSignature) {
      throw new Error('INVALID_OR_EXPIRE_LINK')
    }
    const userId = request.param('id')
    const user = await User.findOrFail(userId)

    user.password = await hash.make(newPassword)

    await user.save()

    await User.accessTokens.query().where('tokenable_id', user.id).delete()

    return {
      message: 'password reset successfully',
    }
  }
}
