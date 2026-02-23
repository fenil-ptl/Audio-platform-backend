import Audio from '#models/audio'
export class PublicService {
  async getAll(page: number, limit: number) {
    return await Audio.query()
      .where('status', 'approve')
      .orderBy('created_at', 'desc')
      .paginate(page, limit)
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
