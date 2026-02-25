import Audio from '#models/audio'
export class PublicService {
  async getAll(page: number, limit: number, genres: string[], moods: string[]) {
    let query = Audio.query()
      .apply((scopes) => scopes.approved())
      .preload('genres')
      .preload('moods')

    if (genres.length > 0) {
      query.whereHas('genres', (q) => {
        q.whereIn('name', genres)
      })
    }

    if (moods.length > 0) {
      query.whereHas('moods', (q) => {
        q.whereIn('name', moods)
      })
    }

    return query.paginate(page, limit)
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
