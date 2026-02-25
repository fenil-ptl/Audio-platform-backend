import User from '#models/user'
import Audio from '#models/audio'
import { DateTime } from 'luxon'

export interface CreateAudioPayload {
  title: string
  slug: string
  bpm: number
  duration: number
  status?: 'approve' | 'pending' | 'reject'
  genreId: number[]
  moodId: number[]
  rejectReason?: string
  fileUrl: string
  imageUrl: string
}

export class AudioService {
  async create(user: User, payload: CreateAudioPayload): Promise<Audio> {
    if (payload.status === 'reject' && !payload.rejectReason) {
      throw new Error('Reject reason is required when status is reject')
    }

    const audio = await Audio.create({
      title: payload.title,
      slug: payload.slug,
      bpm: payload.bpm,
      duration: payload.duration,
      fileUrl: payload.fileUrl,
      imageUrl: payload.imageUrl,
      sellerId: user.id,
      status: payload.status ?? 'pending',
      rejectReason: payload.rejectReason ?? null,
    })

    return audio
  }

  async getAll(user: number, page: number, limit: number): Promise<Audio[]> {
    const query = Audio.query().where('seller_id', user)

    const tracks = await query.paginate(page, limit)
    // if (user.role === 'seller') {
    //   query.where('seller_id', user.id)
    // }
    const data = tracks.all()
    return data
  }

  async getById(id: number, userId: number): Promise<Audio> {
    if (id < 1) {
      throw new Error('INVALID_AUDIO_ID')
    }
    const audio = await Audio.query().where('id', id).where('seller_id', userId).firstOrFail()

    return audio
  }
  async softDelete(audioId: number, sellerId: number): Promise<void> {
    const audio = await Audio.query()
      .where('id', audioId)
      .where('seller_id', sellerId)
      .whereNull('deleted_at')
      .first()

    if (!audio) {
      throw new Error('AUDIO_NOT_FOUND')
    }

    audio.deletedAt = DateTime.now()
    await audio.save()
  }
}
