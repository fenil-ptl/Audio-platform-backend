import { AdminGenreService } from '#services/admin_genre_service'
import { genreValidator, updateGenreValidator } from '#validators/genre'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class AdminGenresController {
  constructor(private service: AdminGenreService) {}

  async createGenres({ request, auth, response }: HttpContext) {
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

  async deleteGenre({ params }: HttpContext) {
    return this.service.deleteGenre(params.id)
  }
}
