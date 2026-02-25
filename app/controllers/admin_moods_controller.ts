import { AdminMoodService } from '#services/admin_mood_service'
import { moodValidator, updateMoodValidator } from '#validators/mood'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
@inject()
export default class AdminMoodsController {
  constructor(private service: AdminMoodService) {}

  async createMood({ request, auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(moodValidator)

    const mood = await this.service.createMood({
      name: payload.name,
      slug: payload.slug,
    })
    return response.ok({
      message: 'mood is created',
      data: mood,
      user: user.id,
    })
  }

  async editMood({ request, auth, response, params }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(updateMoodValidator)

    const updateMood = await this.service.editMood(params.id, payload)

    return response.ok({ updateMood, editBy: user })
  }

  async deleteMood({ params }: HttpContext) {
    return this.service.deleteMood(params.id)
  }
}
