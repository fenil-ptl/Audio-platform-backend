import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { registerValidator } from '#validators/register'
import { loginValidator } from '#validators/login'
import AuthService from '#services/auth_service'
import { forgotPasswordValidator } from '#validators/forgot_password'
import { resetPasswordValidator } from '#validators/resetpassword'
import { resendVerificationEmailValidator } from '#validators/resend_verification_email'
import { inject } from '@adonisjs/core'

@inject()
export default class AuthController {
  constructor(private service: AuthService) {}
  public async register({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(registerValidator)

      const { user } = await this.service.register(payload)

      return response.status(201).send({
        message: 'Registration successful please verify your email',
        user: user.serialize(),
      })
    } catch (error) {
      if (error.message === 'EMAIL_ALREADY_EXISTS') {
        return response.conflict({
          message: 'An account with this email already exists',
        })
      }
      return response.status(400).send({
        message: 'Registration failed',
        errors: error.messages || [error.message],
      })
    }
  }

  public async verifyEmail({ request, response }: HttpContext) {
    try {
      const user = await this.service.verifyEmail(request)
      return response.ok({
        message: `email verify successfully now you can log in`,
        user: user,
      })
    } catch (error) {
      if (error.message === 'INVALID_OR_EXPIRED_LINK') {
        return response.badRequest({
          message: 'Verification link is invalid or has expired. Please request a new one.',
        })
      }

      return response.status(400).send({
        message: error.message,
      })
    }
  }

  public async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await this.service.verifyCredentials(email, password)
      const token = await this.service.generateToken(user)
      return response.send({
        message: 'user logged in successfully',
        user: user.serialize(),
        token: {
          type: 'bearer',
          value: token.value!.release(),
        },
      })
    } catch (error) {
      if (error.message === 'INVALID_CREDENTIALS') {
        return response.unauthorized({
          message: 'Invalid email or password',
        })
      }
      if (error.message === 'EMAIL_NOT_VERIFIED') {
        return response.forbidden({
          message: 'Please verify your email before logging in',
          code: 'EMAIL_NOT_VERIFIED',
        })
      }
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
    return response.ok({ message: 'Logged out successfully' })
  }

  public async me({ auth }: HttpContext) {
    return auth.getUserOrFail()
  }

  public async forgetPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    // const data = email.email

    await this.service.sendResetEmail(email)

    return response.ok({
      message: 'if an account exist with this email, you will receive the reset password link',
    })
  }

  public async resetPassword({ request, response }: HttpContext) {
    const isValidSignature = request.hasValidSignature()
    const { password } = await request.validateUsing(resetPasswordValidator)

    const userId = request.param('id')

    try {
      await this.service.resetPassword(Number(userId), isValidSignature, password)

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
      await this.service.resendVerificationEmail(email)

      return response.ok({
        message: 'Verification email sent successfully.',
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
