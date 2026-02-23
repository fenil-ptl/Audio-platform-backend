import vine from '@vinejs/vine'

export const resetPasswordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(8),
  })
)
