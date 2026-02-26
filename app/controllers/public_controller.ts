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

    const genreInput = request.input('genreIds')
    const moodInput = request.input('moodIds')

    const genreIds =
      typeof genreInput === 'string'
        ? genreInput
            .split(',')
            .map((id) => Number(id.trim()))
            .filter(Boolean)
        : Array.isArray(genreInput)
          ? genreInput.map((id) => Number(id)).filter(Boolean)
          : []

    const moodIds =
      typeof moodInput === 'string'
        ? moodInput
            .split(',')
            .map((id) => Number(id.trim()))
            .filter(Boolean)
        : Array.isArray(moodInput)
          ? moodInput.map((id) => Number(id)).filter(Boolean)
          : []

    const tracks = await this.service.getAll(page, limit, genreIds, moodIds)

    return tracks
  }
  async show({ params }: HttpContext) {
    const track = await this.service.getById(params.id)

    return track
  }
}
