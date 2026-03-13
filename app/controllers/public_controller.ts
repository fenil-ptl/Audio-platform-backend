import { Exception } from '@adonisjs/core/exceptions'
import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Audio from '#models/audio'

const publicIndexValidator = vine.compile(
    vine.object({
        page: vine.number().positive().min(1).max(1000).optional(),
        limit: vine.number().positive().min(1).max(100).optional(),
    })
)

export default class PublicController {
    private parseIds(input: unknown): number[] {
        if (typeof input === 'string') {
            return input
                .split(',')
                .map((v) => Number(v.trim()))
                .filter((n) => n > 0)
        }
        if (Array.isArray(input)) {
            return input.map((v) => Number(v)).filter((n) => n > 0)
        }
        return []
    }

    async index({ request, i18n }: HttpContext) {
        const { page, limit } = await request.validateUsing(publicIndexValidator)

        const genreIds = this.parseIds(request.input('genreIds'))
        const moodIds = this.parseIds(request.input('moodIds'))

        if (genreIds.length > 20) {
            throw new Exception(i18n.t('message.track.genre_limit'), { status: 422 })
        }
        if (moodIds.length > 20) {
            throw new Exception(i18n.t('message.track.mood_limit'), { status: 422 })
        }

        const perPage = limit ?? 10
        const currentPage = page ?? 1
        const offset = (currentPage - 1) * perPage

        const query = Audio.query()
            .where('audio.status', 'approve')
            .whereNull('audio.deleted_at')
            .select(
                'audio.id',
                'audio.title',
                'audio.slug',
                'audio.bpm',
                'audio.duration',
                'audio.file_url',
                'audio.cover_image_url',
                'audio.created_at'
            )
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .orderBy('audio.created_at', 'desc')
            .limit(perPage)
            .offset(offset)

        if (genreIds.length) {
            query
                .join('audio_genres', 'audio.id', 'audio_genres.audio_id')
                .whereIn('audio_genres.genre_id', genreIds)
                .distinct()
        }
        if (moodIds.length) {
            query
                .join('audio_moods', 'audio.id', 'audio_moods.audio_id')
                .whereIn('audio_moods.mood_id', moodIds)
                .distinct()
        }

        const tracks = await query

        return {
            meta: {
                currentPage,
                perPage,
                hasMorePages: tracks.length === perPage,
            },
            data: tracks.map((t) => t.serialize()),
        }
    }

    async show({ params, i18n }: HttpContext) {
        const track = await Audio.query()
            .where('id', Number(params.id))
            .where('status', 'approve')
            .whereNull('deleted_at')
            .select(
                'id',
                'title',
                'slug',
                'bpm',
                'duration',
                'file_url',
                'cover_image_url',
                'created_at'
            )
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .first()

        if (!track) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        return {
            message: i18n.t('message.track.fetched'),
            data: track.serialize(),
        }
    }
}
