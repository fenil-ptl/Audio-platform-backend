import AudioService from '#services/audio_service'
import { createAudioValidator } from '#validators/audio'
import type { HttpContext } from '@adonisjs/core/http'

export default class AudioController {
  async store({ request, auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(createAudioValidator)

    const audio = await AudioService.create(user, payload)

    return response.created({
      message: 'audio track create successfully',
      data: audio.serialize(),
    })
  }

  async index({ auth, response }: HttpContext) {
    const user = auth.use('api').user!

    user.role

    const audios = await AudioService.getAll(user)

    return response.ok({
      message: 'all the audios of this seller fetched',
      data: audios.map((a) => a.serialize()),
    })
  }

  // /get/audio/:id -> single audio
  async show({ params, response }: HttpContext) {
    const audio = await AudioService.getById(params.id)

    return response.ok({
      message: `single audio with id ${params.id} is fetched`,
      data: audio.serialize(),
    })
  }
  async pendingTracks({ response }: HttpContext) {
    const audios = await AudioService.getPendingTracks()

    return response.ok({
      message: 'Pending tracks fetched successfully',
      data: audios.map((a) => a.serialize()),
    })
  }
  async approveTrack({ auth, params, response }: HttpContext) {
    const admin = auth.use('api').user!

    const audio = await AudioService.approveTrack(admin.id, params.id)

    return response.ok({
      message: 'Track approved successfully',
      data: audio.serialize(),
    })
  }
}
