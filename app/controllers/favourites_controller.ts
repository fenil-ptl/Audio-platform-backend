import Favorite from '#models/favourite'
import Audio from '#models/audio'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

export default class FavoritesController {
    // POST /favorites/:audioId  — toggle on/off
    async toggle({ params, auth, i18n }: HttpContext) {
        const user = auth.user!
        const audioId = Number(params.audioId)

        if (Number.isNaN(audioId)) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const track = await Audio.query()
            .where('id', audioId)
            .where('status', 'approve')
            .whereNull('deleted_at')
            .select('id')
            .first()

        if (!track) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const existing = await Favorite.query()
            .where('user_id', user.id)
            .where('audio_id', audioId)
            .first()

        if (existing) {
            await existing.delete()
            return {
                message: i18n.t('message.favorite.removed'),
                favorited: false,
            }
        }

        await Favorite.create({ userId: user.id, audioId })
        return {
            success: true,
            message: i18n.t('message.favorite.added'),
            favorited: true,
        }
    }

    // GET /favorites  — list current user's favorited tracks
    async index({ auth, request, i18n }: HttpContext) {
        const { page, limit } = await request.validateUsing(
            vine.compile(
                vine.object({
                    page: vine.number().positive().min(1).max(1000).optional(),
                    limit: vine.number().positive().min(1).max(100).optional(),
                })
            )
        )

        const favorites = await Favorite.query()
            .where('favourites.user_id', auth.user!.id)
            .preload('audio', (q) =>
                q
                    .where('status', 'approve')
                    .whereNull('deleted_at')
                    .select(
                        'id',
                        'title',
                        'slug',
                        'bpm',
                        'duration',
                        'cover_image_url',
                        'created_at'
                    )
                    .preload('genres', (gq) => gq.select('id', 'name', 'slug'))
                    .preload('moods', (mq) => mq.select('id', 'name', 'slug'))
            )
            .select('id', 'audio_id', 'created_at')
            .orderBy('favourites.created_at', 'desc')
            .paginate(page ?? 1, limit ?? 10)

        return {
            success: true,
            message: i18n.t('message.favorite.fetched'),
            data: favorites.toJSON(),
        }
    }
}
