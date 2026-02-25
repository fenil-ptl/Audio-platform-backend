import Mood from '#models/mood'
import { DateTime } from 'luxon'
export interface CreateMood {
  name: string
  slug: string
}
export class AdminMoodService {
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

    mood.deletedAt = DateTime.now()

    await mood.save()

    return {
      success: true,
    }
  }
}
