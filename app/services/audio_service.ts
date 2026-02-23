import User from '#models/user'
import Audio from '#models/audio'
import Genre from '#models/genre'
import Mood from '#models/mood'
interface CreateAudioServicePayload {
  title: string
  slug: string
  bpm: number
  duration: number
  status?: 'approve' | 'pending' | 'reject'
  rejectReason?: string
  fileUrl: string
  imageUrl: string
}
interface CreateGenre {
  name: 'pop' | 'rock' | 'folk' | 'electronic' | 'jazz'
  slug: string
}
interface CreateMood {
  name: string
  slug: string
}

export class AudioService {
  async create(user: User, payload: CreateAudioServicePayload): Promise<Audio> {
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

  async getById(id: number): Promise<Audio> {
    const audio = await Audio.findOrFail(id)

    return audio
  }

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

  async createGenre(payload: CreateGenre): Promise<Genre> {
    const genre = await Genre.create({
      name: payload.name,
      slug: payload.slug,
    })
    return genre
  }

  async editGenre(genreId: number, payload: any): Promise<Genre> {
    const genre = await Genre.findOrFail(genreId)
    console.log('genre=', genre)
    const edit = genre.merge(payload)

    await edit.save()

    return genre
  }

  async deleteGenre(genreId: number) {
    const genre = await Genre.findOrFail(genreId)

    await genre.delete()

    return {
      success: true,
    }
  }

  async createMood(payload: CreateMood): Promise<Mood> {
    const mood = await Mood.create({
      name: payload.name,
      slug: payload.slug,
    })
    return mood
  }
  async editMood(id: number, payload: any): Promise<Mood> {
    const mood = await Mood.findOrFail(id)

    const edit = mood.merge(payload)

    await edit.save()
    return edit
  }
  async deleteMood(id: number) {
    const mood = await Mood.findOrFail(id)

    await mood.delete()

    return {
      success: true,
    }
  }
}
