import vine from '@vinejs/vine'

export const paginatorValidator = vine.compile(
  vine.object({
    page: vine.number().positive().min(1).max(1000),
    limit: vine.number().positive().min(1).max(100),
  })
)
