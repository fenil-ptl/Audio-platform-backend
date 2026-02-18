import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'

import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'
import string from '@adonisjs/core/helpers/string'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import EmailVerificationToken from '#models/email_verification_token'

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

    await this.sendVerificationEmail(user)

    return user
  }

  static async sendVerificationEmail(user: User) {
    // Clear any existing tokens for this user
    await EmailVerificationToken.query().where('user_id', user.id).delete()

    const token = await EmailVerificationToken.create({
      userId: user.id,
      token: randomUUID(),
      expiresAt: DateTime.now().plus({ hours: 24 }),
    })

    mail.send((message) => {
      message.to(user.email).subject('Verify your account').html(`
          <h2>Welcome ${user.fullName}</h2>
          <p>Click below to verify your account:</p>
          <a href="http://localhost:3333/auth/register/verify-email?token=${token.token}">
            Verify Email
          </a>
        `)
    })
    return {
      url: `http://localhost:3333/auth/register/verify-email?token=${token.token}`,
    }
  }

  static async verifyEmail(token: string) {
    const record = await EmailVerificationToken.query()
      .withScopes((scopes) => scopes.valid())
      .where('token', token)
      .first()

    if (!record) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN')
    }

    const user = await record.related('user').query().firstOrFail()

    user.isEmailVerified = true
    await user.save()

    // Token is single-use
    await record.delete()
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

    await PasswordResetToken.query().where('user_id', user.id).delete()

    const token = string.generateRandom(64)

    await PasswordResetToken.create({
      userId: user.id,
      token: token,
      expiresAt: DateTime.now().plus({ hours: 24 }),
    })

    mail.send((message) => {
      message.to(user.email).subject('Reset your password').html(`
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below:</p>
          <a href="http://localhost:3333/forget-password/${token}">
            Reset Password
          </a>
        `)
    })
    console.log(` reset link : http://localhost:3333/forget-password?token=${token}`)
    return token
  }

  static async resendVerificationEmail(email: string) {
    const user = await User.findBy('email', email)

    if (!user) return { message: 'User not Found' }
    if (user.isEmailVerified) return { message: 'User Already Verified' }

    const url = await this.sendVerificationEmail(user)
    return url
  }

  static async resetPassword(token: string, password: string) {
    // const record = await PasswordResetToken.query()
    //   .withScopes((scopes) => scopes.valid())
    //   .where('token', token)
    //   .first()

    console.log('table name Lucid is using:', PasswordResetToken.table)
    const rawRecord = await PasswordResetToken.query().where('token', token).first()
    console.log('1. Raw record (no scope):', rawRecord)

    // Step 2: check what expires_at looks like
    if (rawRecord) {
      console.log('2. expires_at value:', rawRecord.expiresAt)
      console.log('3. current time:', DateTime.now().toISO())
      console.log('4. is expired?:', rawRecord.expiresAt < DateTime.now())
    }

    // Step 3: now try with scope
    const record = await PasswordResetToken.query()
      .withScopes((scopes) => scopes.valid())
      .where('token', token)
      .first()
    console.log('5. Record with scope:', record)

    console.log('record found:', record)
    if (!record) {
      throw new Error('no record found')
    }

    const user = await record.related('user').query().firstOrFail()

    // Assigning the plain password triggers the beforeSave hook (hashing)
    user.password = password
    await user.save()

    await record.delete()
  }
}
