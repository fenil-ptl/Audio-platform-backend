import { AdminTrackService } from '#services/admin_track_service'
import { paginatorValidator } from '#validators/pagination'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class AdminTracksController {
  constructor(private service: AdminTrackService) {}

  async pendingTracks({ request, response }: HttpContext) {
    const { page, limit } = await request.validateUsing(paginatorValidator)
    const audios = await this.service.getPendingTracks(page, limit)

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
}
