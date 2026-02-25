import Audio from '#models/audio'

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
export class AdminTrackService {
  async getPendingTracks(page: number, limit: number): Promise<Audio[]> {
    const pendingTrack = Audio.query()
      .where('status', 'pending')
      .preload('seller')
      .orderBy('created_at', 'desc')

    const tracks = pendingTrack.paginate(page, limit)
    return tracks
  }

  async approveTrack(adminId: number, audioId: number): Promise<Audio> {
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

  async rejectTrack(adminId: number, audioId: number): Promise<Audio> {
    const audio = await Audio.findOrFail(audioId)

    if (audio.status === 'reject') {
      throw new Error(' Track is already rejected ')
    }

    await audio
      .merge({
        status: 'reject',
        reviewedBy: adminId,
        rejectReason: `user with id ${adminId} rejected track`,
      })
      .save()
    return audio
  }
}
