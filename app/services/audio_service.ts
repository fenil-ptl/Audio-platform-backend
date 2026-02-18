import User from '#models/user'
import Audio from '#models/audio'
import type { CreateAudioPayload } from '#validators/audio'
export default class AudioService {
  static async create(user: User, payload: CreateAudioPayload): Promise<Audio> {
    if (payload.status === 'reject' && !payload.rejectReason) {
    }
    const audio = await Audio.create({
      ...payload,
      sellerId: user.id,
      status: payload.status ?? 'pending',
      rejectReason: payload.rejectReason ?? null,
    })
    return audio
  }
  static async getAll(user: User): Promise<Audio[]> {
    const query = Audio.query()

    if (user.role === 'seller') {
      query.where('seller_id', user.id)
    }

    return query.orderBy('created_at', 'desc')
  }
  static async getById(id: number): Promise<Audio> {
    const audio = await Audio.findOrFail(id)

    return audio
  }
  static async getPendingTracks(): Promise<Audio[]> {
    return Audio.query()
      .where('status', 'pending')
      .preload('seller') // so admin can see which seller created it
      .orderBy('created_at', 'desc')
  }
  static async approveTrack(adminId: number, audioId: number): Promise<Audio> {
    const audio = await Audio.findOrFail(audioId)

    if (audio.status !== 'pending') {
      throw new Error('track is approved , and status is not pending ')
    }

    await audio
      .merge({
        status: 'approve',
        reviewedBy: adminId,
        rejectReason: null,
      })
      .save()

    return audio
  }
}
