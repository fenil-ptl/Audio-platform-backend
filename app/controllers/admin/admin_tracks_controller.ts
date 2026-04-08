import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Audio from '#models/audio'
import { DateTime } from 'luxon'

export default class AdminTracksController {
    async pendingTracks({ request, i18n }: HttpContext) {
        const { page, limit } = await request.validateUsing(
            vine.compile(
                vine.object({
                    page: vine.number().positive().withoutDecimals().min(1).max(1000).optional(),
                    limit: vine.number().positive().withoutDecimals().min(1).max(100).optional(),
                })
            )
        )

        const currentPage = page ?? 1
        const perPage = limit ?? 10

        const tracks = await Audio.query()
            .where('status', 'pending')
            .whereNull('deleted_at')
            .select('id', 'seller_id', 'title', 'slug', 'bpm', 'duration', 'created_at')
            .preload('seller', (q) => q.select('id', 'fullName', 'email'))
            .orderBy('created_at', 'desc')
            .limit(perPage)
            .offset((currentPage - 1) * perPage)

        // OPTIONAL: count (if you really need it)
        const total = await Audio.query()
            .where('status', 'pending')
            .whereNull('deleted_at')
            .count('* as total')
            .first()

        return {
            success: true,
            message: i18n.t('message.track.pending_fetched'),
            data: tracks,
            meta: {
                currentPage,
                perPage,
                total: total ? Number(total.$extras.total) : 0,
            },
        }
    }

    async approveTrack({ auth, params, i18n }: HttpContext) {
        const adminId = auth.user!.id
        const audioId = Number(params.id)

        if (Number.isNaN(audioId)) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const audio = await Audio.query()
            .where('id', audioId)
            .whereNull('deleted_at')
            .select('id', 'status', 'reviewed_by')
            .first()

        if (!audio) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }
        if (audio.status !== 'pending') {
            throw new Exception(i18n.t('message.track.pending_only'), { status: 422 })
        }

        await audio
            .merge({
                status: 'approve',
                reviewedBy: adminId,
                rejectReason: null,
                reviewedAt: DateTime.now(),
            })
            .save()

        return {
            success: true,
            message: i18n.t('message.track.approved'),
            data: {
                id: audio.id,
                status: audio.status,
                reviewedAt: audio.reviewedAt,
            },
        }
    }

    async rejectTrack({ auth, params, request, i18n }: HttpContext) {
        const adminId = auth.user!.id
        const audioId = Number(params.id)

        if (Number.isNaN(audioId)) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const { rejectReason } = await request.validateUsing(
            vine.compile(
                vine.object({
                    rejectReason: vine.string().trim().minLength(10).maxLength(500),
                })
            )
        )

        const audio = await Audio.query()
            .where('id', audioId)
            .whereNull('deleted_at')
            .select('id', 'status', 'reviewed_by')
            .first()

        if (!audio) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }
        if (audio.status === 'reject') {
            throw new Exception(i18n.t('message.track.already_rejected'), { status: 422 })
        }

        await audio.merge({ status: 'reject', reviewedBy: adminId, rejectReason }).save()

        return {
            success: true,
            message: i18n.t('message.track.rejected'),
            data: {
                id: audio.id,
                status: 'reject',
                rejectReason: rejectReason,
                reviewedBy: adminId,
            },
        }
    }
}
