// import type { HttpContext } from '@adonisjs/core/http'

import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { registerValidator } from '#validators/register'
import { loginValidator } from '#validators/login'
import AuthService from '#services/auth_service'
import { forgotPasswordValidator } from '#validators/forgot_password'
import { resetPasswordValidator } from '#validators/resetpassword'
import { resendVerificationEmailValidator } from '#validators/resend_verification_email'

export default class AuthController {
  public async register({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(registerValidator)

      const { user, verificationUrl } = await AuthService.register(payload)

      return response.status(201).send({
        message: 'Registration successful please verify your email',
        verificationUrl,
        user: user.serialize(),
      })
    } catch (error) {
      return response.status(400).send({
        messages: 'Registration failed | Bad Request ',
        error: error.messages,
      })
    }
  }

  public async verifyEmail({ request }: HttpContext) {
    await AuthService.verifyEmail(request)
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
      return response.status(400).send({
        message: 'Please verify your credentials',
        error: error,
      })
    }
  }
  public async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const token = user.currentAccessToken

    if (!token) {
      return response.unauthorized({ message: 'no active token found' })
    }
    await User.accessTokens.delete(user, token.identifier)
    return response.ok({ message: 'Logged out', userId: user.id })
  }

  public async me({ auth }: HttpContext) {
    return auth.getUserOrFail()
  }

  public async forgetPassword({ request, response }: HttpContext) {
    const email = await request.validateUsing(forgotPasswordValidator)

    const data = email.email

    const url = await AuthService.sendResetEmail(data)

    return response.ok({
      mail: data,
      url: url,
    })
  }

  public async resetPassword({ request, response }: HttpContext) {
    const { password } = await request.validateUsing(resetPasswordValidator)

    try {
      await AuthService.resetPassword(request, password)

      return response.ok({
        message: 'Password has been reset successfully. You can now log in.',
      })
    } catch (error) {
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

      return response.ok({
        message: 'Verification email sent successfully.',
        result,
      })
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return response.notFound({ message: 'User not found' })
      }

      if (error.message === 'EMAIL_IS_ALREADY_VERIFIED') {
        return response.notFound({ message: 'email is already verified' })
      }

      return response.internalServerError({
        message: 'Failed to send verification email.',
        error: error.message,
      })
    }
  }
}
