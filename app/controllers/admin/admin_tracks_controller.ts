import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Audio from '#models/audio'

const pendingValidator = vine.compile(
    vine.object({
        page: vine.number().positive().withoutDecimals().min(1).max(1000),
        limit: vine.number().positive().withoutDecimals().min(1).max(100),
    })
)

const rejectValidator = vine.compile(
    vine.object({
        rejectReason: vine.string().trim().minLength(10).maxLength(500),
    })
)

export default class AdminTracksController {
    async pendingTracks({ request, i18n }: HttpContext) {
        const { page, limit } = await request.validateUsing(pendingValidator)

        const tracks = await Audio.query()
            .where('status', 'pending')
            .whereNull('deleted_at')
            .select('id', 'title', 'slug', 'bpm', 'duration', 'status', 'created_at')
            .preload('seller', (q) => q.select('id', 'fullName', 'email'))
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .orderBy('created_at', 'desc')
            .paginate(page, limit)

        return {
            message: i18n.t('messages.track.pending_fetched'),
            data: tracks.toJSON(),
        }
    }

    async approveTrack({ auth, params, i18n }: HttpContext) {
        const adminId = auth.user!.id
        const audioId = Number(params.id)

        if (Number.isNaN(audioId)) {
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }

        const audio = await Audio.query()
            .where('id', audioId)
            .whereNull('deleted_at')
            .select('id', 'status', 'reviewed_by')
            .first()

        if (!audio) {
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }
        if (audio.status !== 'pending') {
            throw new Exception(i18n.t('messages.track.pending_only'), { status: 422 })
        }

        await audio.merge({ status: 'approve', reviewedBy: adminId, rejectReason: null }).save()

        return { message: i18n.t('messages.track.approved') }
    }

    async rejectTrack({ auth, params, request, i18n }: HttpContext) {
        const adminId = auth.user!.id
        const audioId = Number(params.id)

        if (Number.isNaN(audioId)) {
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }

        const { rejectReason } = await request.validateUsing(rejectValidator)

        const audio = await Audio.query()
            .where('id', audioId)
            .whereNull('deleted_at')
            .select('id', 'status', 'reviewed_by')
            .first()

        if (!audio) {
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }
        if (audio.status === 'reject') {
            throw new Exception(i18n.t('messages.track.already_rejected'), { status: 422 })
        }

        await audio.merge({ status: 'reject', reviewedBy: adminId, rejectReason }).save()

        return { message: i18n.t('messages.track.rejected') }
    }
}
