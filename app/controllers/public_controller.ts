// import type { HttpContext } from '@adonisjs/core/http'
import { PublicService } from '#services/public_service'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class PublicController {
  constructor(private service: PublicService) {}

  async index({ request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 5)

    const tracks = await this.service.getAll(page, limit)

    return tracks
  }
  async show({ params }: HttpContext) {
    const track = await this.service.getById(params.id)

    return track
  }
}
