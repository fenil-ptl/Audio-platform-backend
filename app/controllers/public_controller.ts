// import type { HttpContext } from '@adonisjs/core/http'
import { PublicService } from '#services/public_service'
import { paginatorValidator } from '#validators/pagination'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class PublicController {
  constructor(private service: PublicService) {}

  async index({ request }: HttpContext) {
    const { page, limit } = await request.validateUsing(paginatorValidator)

    const genreSlugs = request.input('genres')
    const moodSlugs = request.input('moods')

    const genres = genreSlugs ? genreSlugs.split(',') : []
    const moods = moodSlugs ? moodSlugs.split(',') : []

    const tracks = await this.service.getAll(page, limit, genres, moods)

    return tracks
  }
  async show({ params }: HttpContext) {
    const track = await this.service.getById(params.id)

    return track
  }
}
