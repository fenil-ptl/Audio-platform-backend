import vine from '@vinejs/vine'

export const genreValidator = vine.compile(
  vine.object({
    name: vine.enum(['pop', 'rock', 'folk', 'electronic', 'jazz'] as const),
    slug: vine.string().minLength(5),
  })
)

export const updateGenreValidator = vine.compile(
  vine.object({
    name: vine.string().trim().optional(),
    slug: vine.string().optional(),
  })
)
