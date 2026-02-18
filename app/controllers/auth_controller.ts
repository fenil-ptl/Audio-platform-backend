// import type { HttpContext } from '@adonisjs/core/http'

import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { registerValidator } from '#validators/register'
import { loginValidator } from '#validators/login'
import AuthService from '#services/auth_service'
import { forgotPasswordValidator } from '#validators/forgot_password'
import { resetPasswordValidator } from '#validators/resetpassword'
import { resendVerificationEmailValidator } from '#validators/resend_verification_email'
import PasswordResetToken from '#models/password_reset_token'

export default class AuthController {
  public async register({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(registerValidator)

      const user = await AuthService.register(payload)

      const token = await AuthService.generateToken(user)

      return response.status(201).send({
        message: 'Registration successful please verify your email',
        token: {
          type: 'bearer',
          value: token.value!.release(),
        },
        user: user.serialize(),
      })
    } catch (error) {
      return response.status(400).send({
        messages: 'Registration failed | Bad Request ',
        error: error.message,
      })
    }
  }

  public async verifyEmail({ request }: HttpContext) {
    await AuthService.verifyEmail(request.qs().token)
    return `email verify`
  }

  public async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await AuthService.verifyCredentials(email, password)
      const token = await AuthService.generateToken(user)
      return response.send({
        message: 'user log in successfully',
        user: user.serialize(),
        token: {
          type: 'bearer',
          value: token.value!.release(),
        },
      })
    } catch (error) {
      const message =
        error.message === 'ACCOUNT_DISABLED'
          ? 'Please verify your email before logging in.'
          : 'Invalid email or password.'
      return response.status(400).send({
        message,
        error: error,
      })
    }
  }
  public async logout({ auth, response }: HttpContext) {
    // const user = auth.getUserOrFail()
    const user = auth.use('api').user!
    const tokenIdentifier = user.currentAccessToken.identifier
    await User.accessTokens.delete(user, tokenIdentifier)
    return response.ok({ message: 'Logged out' })
  }

  public async me({ auth }: HttpContext) {
    return auth.getUserOrFail()
  }

  public async forgetPassword({ request, response }: HttpContext) {
    const email = await request.validateUsing(forgotPasswordValidator)

    const data = email.email

    const token = await AuthService.sendResetEmail(data)

    return response.ok({
      mail: data,
      token: token,
      url: ` reset link : http://localhost:3333/forget-password/reset-password?token=${token}`,
    })
  }

  public async resetPassword({ request, response }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)

    const rawRecord = await PasswordResetToken.query().where('token', token).first()

    console.log('token from DB:', JSON.stringify(rawRecord?.token))

    try {
      await AuthService.resetPassword(token, password)

      return response.ok({
        message: 'Password has been reset successfully. You can now log in.',
      })
    } catch (error) {
      console.error('reset pass err =', error)
      return response.badRequest({
        message: 'invalid or expire token ',
        error: error.message,
      })
    }
  }
  public async resendVerificationEmail({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(resendVerificationEmailValidator)

    try {
      const result = await AuthService.resendVerificationEmail(email)

      if (result?.message === 'User not Found') {
        return response.notFound({ message: result.message })
      }

      if (result?.message === 'User Already Verified') {
        return response.conflict({ message: result.message })
      }

      return response.ok({
        message: 'Verification email sent successfully.',
        result,
      })
    } catch (error) {
      console.error('resendVerificationEmail error:', error)
      return response.internalServerError({
        message: 'Failed to send verification email.',
        error: error.message,
      })
    }
  }
}
