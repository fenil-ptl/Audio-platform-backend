import Audio from '#models/audio'

export class PublicService {
  async getAll(page: number, limit: number, genreIds: number[], moodIds: number[]) {
    const safeLimit = Math.min(limit, 100)

    let query = Audio.query()
      .where('audio.status', 'approve')
      .whereNull('audio.deleted_at')
      .select(['audio.id', 'audio.title', 'audio.bpm', 'audio.duration', 'audio.created_at'])

    if (genreIds.length > 0) {
      query.whereHas('genres', (genreQuery) => {
        genreQuery.whereIn('genre_id', genreIds).select(['id', 'name'])
      })
    }

    if (moodIds.length > 0) {
      query.whereHas('moods', (moodQuery) => {
        moodQuery.whereIn('mood_id', moodIds).select(['id', 'name'])
      })
    }

    query.orderBy('audio.created_at', 'desc')

    return query.offset((page - 1) * safeLimit).limit(safeLimit)
  }

  async getById(id: number) {
    const track = await Audio.find(id)

    if (!track) {
      throw new Error(' Track not found ')
    }
    if (track.status !== 'approve') {
      throw new Error(' only Approve Track can  accessed  ')
    }

    return track
  }
}
