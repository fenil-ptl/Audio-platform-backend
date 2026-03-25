import { Exception } from '@adonisjs/core/exceptions'
import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Audio from '#models/audio'
import Genre from '#models/genre'
import Mood from '#models/mood'
import TrackFilterService from '#services/track_filter_service'
import type { TrackFilterDto, SortBy, SortOrder } from '#dtos/track_filter_dto'

export default class PublicController {
    private parseStrings(input: any): string[] {
        if (!input) return []
        if (Array.isArray(input)) return input.map(String).filter(Boolean)
        return String(input)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    }

    async index({ request, i18n }: HttpContext) {
        const { limit, search, sortBy, sortOrder, minDuration, maxDuration, artistId } =
            await request.validateUsing(
                vine.compile(
                    vine.object({
                        limit: vine.number().positive().min(1).max(100).optional(),
                        search: vine.string().trim().minLength(1).maxLength(100).optional(),
                        sortBy: vine
                            .enum(['created_at', 'title', 'duration', 'random'] as const)
                            .optional(),
                        sortOrder: vine.enum(['asc', 'desc'] as const).optional(),
                        minDuration: vine.number().positive().optional(), // seconds e.g. 60
                        maxDuration: vine.number().positive().optional(), // seconds e.g. 300
                        artistId: vine.number().positive().optional(),
                    })
                )
            )

        const genreNames = this.parseStrings(request.input('genres'))
        const moodNames = this.parseStrings(request.input('moods'))

        if (genreNames.length > 20)
            throw new Exception(i18n.t('message.track.genre_limit'), { status: 422 })
        if (moodNames.length > 20)
            throw new Exception(i18n.t('message.track.mood_limit'), { status: 422 })

        const perPage = limit ?? 10

        const [genreIds, moodIds] = await Promise.all([
            genreNames.length > 0
                ? Genre.query()
                      .whereIn('name', genreNames)
                      .select('id')
                      .then((r) => r.map((g) => g.id))
                : Promise.resolve<number[]>([]),
            moodNames.length > 0
                ? Mood.query()
                      .whereIn('name', moodNames)
                      .select('id')
                      .then((r) => r.map((m) => m.id))
                : Promise.resolve<number[]>([]),
        ])

        const dto: TrackFilterDto = {
            perPage,
            cursorCreatedAt: request.input('cursor_created_at') ?? null,
            cursorId: request.input('cursor_id') ?? null,
            search: search ?? null,
            sortBy: (sortBy ?? 'created_at') as SortBy,
            sortOrder: (sortOrder ?? 'desc') as SortOrder,
            genreIds,
            moodIds,
            artistId: artistId ?? null,
            minDuration: minDuration ?? null,
            maxDuration: maxDuration ?? null,
        }

        const query = Audio.query()
            .from('audio as a')
            .where('a.status', 'approve')
            .whereNull('a.deleted_at')
            .select(['a.id', 'a.title', 'a.bpm', 'a.duration', 'a.cover_image_url', 'a.created_at'])
            .limit(perPage + 1)

        TrackFilterService.apply(query, dto)

        const [rows, total] = await Promise.all([query, TrackFilterService.getTotalCount(dto)])

        const hasMore = rows.length > perPage
        const data = hasMore ? rows.slice(0, perPage) : rows
        const last = data.at(-1)
        const totalPages = Math.ceil(total / perPage)

        return {
            success: true,
            message: i18n.t('message.track.fetched'),
            meta: {
                perPage,
                hasMore,
                total,
                totalPages,
                nextCursor:
                    hasMore && last && dto.sortBy === 'created_at'
                        ? { cursor_created_at: last.createdAt.toISO(), cursor_id: last.id }
                        : null,
            },
            data: data.map((t) => t.serialize()),
        }
    }

    async show({ params, i18n }: HttpContext) {
        const track = await Audio.query()
            .where('id', Number(params.id))
            .where('status', 'approve')
            .whereNull('deleted_at')
            .select('id', 'title', 'bpm', 'duration', 'cover_image_url', 'created_at')
            .first()

        if (!track) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        return {
            success: true,
            message: i18n.t('message.track.fetched'),
            data: track,
        }
    }

    async getByGenre({ params, request, i18n }: HttpContext) {
        const genreName = params.genreName

        const genre = await Genre.query().where('name', genreName).select('id').first()

        if (!genre) {
            throw new Exception(i18n.t('message.genre.not_found'), { status: 404 })
        }

        const perPage = Math.min(request.input('limit', 10), 100)

        const rawCursorCreatedAt = request.input('cursor_created_at') ?? null
        const rawCursorId = request.input('cursor_id') ?? null

        const cursorCreatedAt =
            rawCursorCreatedAt && !Number.isNaN(Date.parse(rawCursorCreatedAt))
                ? rawCursorCreatedAt
                : null

        const cursorId =
            rawCursorId && !Number.isNaN(Number(rawCursorId)) ? Number(rawCursorId) : null

        const hasCursor = cursorCreatedAt !== null && cursorId !== null

        // 3. Correct query — start from Audio model, join genres
        //    Requires composite index: (status, deleted_at, genre_id, created_at, id)
        const rows = await Audio.query()
            .join('audio_genres as ag', 'ag.audio_id', 'audio.id')
            .where('ag.genre_id', genre.id)
            .where('audio.status', 'approve')
            .whereNull('audio.deleted_at')

            // 4. Cursor pagination with correct ordering
            .if(hasCursor, (q) => {
                q.where((q2) => {
                    q2.where('audio.created_at', '<', cursorCreatedAt!).orWhere((q3) => {
                        q3.where('audio.created_at', '=', cursorCreatedAt!).where(
                            'audio.id',
                            '<',
                            cursorId!
                        )
                    })
                })
            })

            // 5. Always include ORDER BY for deterministic cursor pagination
            .orderBy('audio.created_at', 'desc')
            .orderBy('audio.id', 'desc')

            // 6. Select only needed columns (avoid SELECT *)
            .select([
                'audio.id',
                'audio.title',
                'audio.duration',
                'audio.cover_image_url',
                'audio.created_at',
            ])

            .limit(perPage + 1)

        // 7. Cursor pagination meta
        const hasMore = rows.length > perPage
        const data = hasMore ? rows.slice(0, perPage) : rows
        const last = data[data.length - 1]

        return {
            success: true,
            message: i18n.t('message.track.fetched'),
            meta: {
                perPage,
                hasMore,
                nextCursor:
                    hasMore && last
                        ? {
                              cursor_created_at: last.createdAt.toISO(),
                              cursor_id: last.id,
                          }
                        : null,
            },
            data: data.map((t) => t.serialize()),
        }
    }

    async getByMood({ params, request, i18n }: HttpContext) {
        const moodName = params.moodName

        const mood = await Mood.query().where('name', moodName).select('id').first()

        if (!mood) {
            throw new Exception(i18n.t('message.mood.not_found'), { status: 404 })
        }

        const perPage = Math.min(request.input('limit', 10), 100)

        const rawCursorCreatedAt = request.input('cursor_created_at') ?? null
        const rawCursorId = request.input('cursor_id') ?? null

        const cursorCreatedAt =
            rawCursorCreatedAt && !Number.isNaN(Date.parse(rawCursorCreatedAt))
                ? rawCursorCreatedAt
                : null

        const cursorId =
            rawCursorId && !Number.isNaN(Number(rawCursorId)) ? Number(rawCursorId) : null

        const hasCursor = cursorCreatedAt !== null && cursorId !== null

        const rows = await Audio.query()
            .join('audio_moods as am', 'am.audio_id', 'audio.id')
            .where('am.mood_id', mood.id)
            .where('audio.status', 'approve')
            .whereNull('audio.deleted_at')

            .if(hasCursor, (q) => {
                q.where((q2) => {
                    q2.where('audio.created_at', '<', cursorCreatedAt!).orWhere((q3) => {
                        q3.where('audio.created_at', '=', cursorCreatedAt!).where(
                            'audio.id',
                            '<',
                            cursorId!
                        )
                    })
                })
            })

            .orderBy('audio.created_at', 'desc')
            .orderBy('audio.id', 'desc')

            .select([
                'audio.id',
                'audio.title',
                'audio.duration',
                'audio.cover_image_url',
                'audio.created_at',
            ])

            .limit(perPage + 1)

        const hasMore = rows.length > perPage
        const data = hasMore ? rows.slice(0, perPage) : rows
        const last = data.at(-1)

        return {
            success: true,
            message: i18n.t('message.track.fetched'),
            meta: {
                perPage,
                hasMore,
                nextCursor:
                    hasMore && last
                        ? {
                              cursor_created_at: last.createdAt.toISO(),
                              cursor_id: last.id,
                          }
                        : null,
            },
            data: data.map((t) => t.serialize()),
        }
    }
}
