import { AudioService } from '#services/seller_track_service'
import { createAudioValidator } from '#validators/audio'
import { paginatorValidator } from '#validators/pagination'
import { inject } from '@adonisjs/core'
import { cuid } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

@inject()
export default class AudioController {
  constructor(private service: AudioService) {}

  async store({ request, auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(createAudioValidator)
    const audioFile = payload.fileUrl
    const imageFile = payload.imageUrl

    const audioFileName = `${cuid()}.${audioFile.extname}`

    await audioFile.move(app.tmpPath('audio'), {
      name: audioFileName,
    })

    const imageFileName = `${cuid()}.${imageFile.extname}`

    await imageFile.move(app.tmpPath('images'), {
      name: imageFileName,
    })

    const audio = await this.service.create(user, {
      title: payload.title,
      slug: payload.slug,
      bpm: payload.bpm,
      duration: payload.duration,
      rejectReason: payload.rejectReason,
      fileUrl: `audio/${audioFileName}`,
      imageUrl: `images/${imageFileName}`,
      genreId: [],
      moodId: [],
    })
    await audio.related('genres').attach(payload.genreId)
    await audio.related('moods').attach(payload.moodId)
    return response.created({
      message: 'audio track create successfully',
    })
  }

  async index({ auth, request }: HttpContext) {
    const userId = auth.user!.id
    const { page, limit } = await request.validateUsing(paginatorValidator)
    return this.service.getAll(userId, page, limit)
  }

  async show({ params, response }: HttpContext) {
    const audio = await this.service.getById(params.id)

    return response.ok({
      message: `single audio with id ${params.id} is fetched`,
      data: audio.serialize(),
    })
  }
}
