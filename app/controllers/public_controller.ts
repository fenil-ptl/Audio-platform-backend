import { Exception } from '@adonisjs/core/exceptions'
import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Audio from '#models/audio'

const publicIndexValidator = vine.compile(
    vine.object({
        page: vine.number().positive().min(1).max(1000),
        limit: vine.number().positive().min(1).max(100),
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
            throw new Exception(i18n.t('messages.track.genre_limit'), { status: 422 })
        }
        if (moodIds.length > 20) {
            throw new Exception(i18n.t('messages.track.mood_limit'), { status: 422 })
        }

        const query = Audio.query()
            .where('status', 'approve')
            .whereNull('deleted_at')
            .select('id', 'title', 'slug', 'bpm', 'duration', 'file_url', 'image_url', 'created_at')
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .orderBy('created_at', 'desc')

        if (genreIds.length) {
            query.whereHas('genres', (q) => q.whereIn('genre_id', genreIds))
        }
        if (moodIds.length) {
            query.whereHas('moods', (q) => q.whereIn('mood_id', moodIds))
        }

        const tracks = await query.paginate(page, limit)

        return tracks.toJSON()
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
                'image_url',
                'created_at',
                'updated_at'
            )
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .first()

        if (!track) {
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }

        return {
            message: i18n.t('messages.track.fetched'),
            data: track.serialize(),
        }
    }
}
