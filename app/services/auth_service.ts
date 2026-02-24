import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
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

    this.sendVerificationEmail(user)

    return { user }
  }

  static async sendVerificationEmail(user: User) {
    const signedUrl = router.makeSignedUrl(
      'verifyEmail',
      { id: user.id },
      {
        expiresIn: '24h',
      }
    )

    await mail.send((message) => {
      message.to(user.email).subject('Verify your account').html(`
          <h2>Welcome ${user.fullName}</h2>
          <p>Click below to verify your account:</p>
          <a href="http://localhost:3333${signedUrl}">
            Verify Email
          </a>
        `)
    })
  }

  static async verifyEmail(request: HttpContext['request']) {
    if (!request.hasValidSignature()) {
      throw new Error('INVALID_OR_EXPIRED_LINK')
    }

    const userId = request.param('id')

    const user = await User.findOrFail(userId)

    user.isEmailVerified = true
    await user.save()

    return user
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
      throw new Error('EMAIL_NOT_VERIFIED')
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
      return
    }
    const signedUrl = router.makeSignedUrl(
      'resetPassword',
      { id: user.id },
      {
        expiresIn: '15m',
      }
    )

    await mail.send((message) => {
      message.to(user.email).subject('Reset your password').html(`
            <h2>Password Reset</h2>
            <p>You requested a password reset. Click the link below:</p>
            <a href="http://localhost:3333${signedUrl}">
              Reset Password
            </a>
          `)
    })
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

  static async resetPassword(userId: number, isValidSignature: boolean, newPassword: string) {
    if (!isValidSignature) {
      throw new Error('INVALID_OR_EXPIRE_LINK')
    }
    const user = await User.findOrFail(userId)

    user.password = newPassword
    await user.save()

    await User.accessTokens.all(user).then((tokens) => {
      return Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)))
    })

    return {
      message: 'Password reset successfully',
    }
  }
}
