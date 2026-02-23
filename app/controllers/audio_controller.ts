import { AudioService } from '#services/audio_service'
import { createAudioValidator } from '#validators/audio'
import { genreValidator, updateGenreValidator } from '#validators/genre'
import { moodValidator, updateMoodValidator } from '#validators/mood'
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

    if (!audioFile || !imageFile) {
      return response.badRequest({
        message: ' failed,   upload audio files is require',
      })
    }

    const audioFileName = `${cuid()}.${audioFile.extname}`

    await audioFile.move(app.tmpPath('audio'), {
      name: audioFileName,
    })

    const imageFileName = `${cuid()}.${imageFile.extname}`

    await imageFile.move(app.tmpPath('images'), {
      name: imageFileName,
    })

    const audio = this.service.create(user, {
      title: payload.title,
      slug: payload.slug,
      bpm: payload.bpm,
      duration: payload.duration,
      status: payload.status,
      rejectReason: payload.rejectReason,
      fileUrl: `audio/${audioFileName}`, // Store relative path
      imageUrl: `images/${imageFileName}`, // Store relative path
    })

    return response.created({
      message: 'audio track create successfully',
      data: audio,
    })
  }

  async index({ auth }: HttpContext) {
    const userId = auth.user!.id

    // user.role

    // const audios = await AudioService.getAll(userId, 1, 5)

    return this.service.getAll(userId, 1, 2)
  }

  async show({ params, response }: HttpContext) {
    const audio = await this.service.getById(params.id)

    return response.ok({
      message: `single audio with id ${params.id} is fetched`,
      data: audio.serialize(),
    })
  }

  async pendingTracks({ response }: HttpContext) {
    const audios = await this.service.getPendingTracks(1, 5)

    return response.ok({
      message: 'Pending tracks fetched successfully',
      data: audios,
    })
  }

  async approveTrack({ auth, params, response }: HttpContext) {
    const admin = auth.use('api').user!

    const audio = await this.service.approveTrack(admin.id, params.id)

    return response.ok({
      message: 'Track approved successfully',
      data: audio.serialize(),
    })
  }

  async rejectTrack({ auth, params, response }: HttpContext) {
    const admin = auth.use('api').user!

    const audio = await this.service.rejectTrack(admin.id, params.id)

    return response.ok({
      message: 'track reject successfully',
      data: audio.serialize(),
    })
  }

  async genres({ request, auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(genreValidator)

    const genre = await this.service.createGenre({
      name: payload.name,
      slug: payload.slug,
    })
    return response.ok({
      Message: 'new genre is create',
      data: genre,
      user: user.id,
    })
  }

  async editGenres({ request, params, auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(updateGenreValidator)
    const editGenre = await this.service.editGenre(params.id, payload)
    return response.ok({ editGenre, editBy: user })
  }

  async deleteGenre({ auth, params }: HttpContext) {
    const user = auth.use('api').user!
    return this.service.deleteGenre(params.id)
  }

  async editMood({ request, auth, response, params }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await request.validateUsing(updateMoodValidator)

    const updateMood = await this.service.editMood(params.id, payload)

    return response.ok({ updateMood, editBy: user })
  }

  async mood({ request, auth, response }: HttpContext) {
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

  async deleteMood({ params, auth }: HttpContext) {
    const user = auth.use('api').user!
    // const mood = this.service.deleteMood(params.id)

    return this.service.deleteMood(params.id)
  }
}
