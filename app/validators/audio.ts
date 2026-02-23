import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

export const createAudioValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(3),
    slug: vine.string().minLength(5),

    // fileUrl: vine.string(),
    // imageUrl: vine.string(),

    bpm: vine.number(),
    duration: vine.number(),
    status: vine.enum(['approve', 'pending', 'reject'] as const).optional(),
    rejectReason: vine.string().trim().optional(),

    fileUrl: vine.file({
      size: '5mb',
      extnames: ['mp3', 'm4a'],
    }),

    imageUrl: vine.file({
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png'],
    }),
  })
)
export type CreateAudioPayload = Infer<typeof createAudioValidator>
