import vine from '@vinejs/vine'

export const moodValidator = vine.compile(
  vine.object({
    name: vine.string(),
    slug: vine.string(),
  })
)

export const updateMoodValidator = vine.compile(
  vine.object({
    name: vine.string().optional(),
    slug: vine.string().optional(),
  })
)
