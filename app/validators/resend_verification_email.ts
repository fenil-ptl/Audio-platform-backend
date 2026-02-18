import vine from '@vinejs/vine'
export const resendVerificationEmailValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
  })
)
