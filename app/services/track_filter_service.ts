import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Audio from '#models/audio'
import type { TrackFilterDto } from '#dtos/track_filter_dto'

type AudioQuery = ModelQueryBuilderContract<typeof Audio>

export default class TrackFilterService {
    // ── single public entry point ──────────────────────────────
    static apply(query: AudioQuery, dto: TrackFilterDto): AudioQuery {
        this.applySearch(query, dto)
        this.applyGenres(query, dto)
        this.applyMoods(query, dto)
        this.applyArtist(query, dto)
        this.applyDuration(query, dto)
        this.applySort(query, dto)
        this.applyCursor(query, dto)
        return query
    }

    // ── search ─────────────────────────────────────────────────
    private static applySearch(query: AudioQuery, { search }: TrackFilterDto) {
        if (!search) return
        // whereRaw prevents SQL injection while allowing LIKE wildcard
        query.whereRaw('a.title LIKE ?', [`%${search}%`])
    }

    // ── genre filter ───────────────────────────────────────────
    // ── genre filter ───────────────────────────────────────────
    private static applyGenres(query: AudioQuery, { genreIds }: TrackFilterDto) {
        if (genreIds.length === 0) return

        // build one ? placeholder per id → safe, no SQL injection
        const placeholders = genreIds.map(() => '?').join(', ')

        query.joinRaw(
            `INNER JOIN (
            SELECT DISTINCT audio_id
            FROM audio_genres
            WHERE genre_id IN (${placeholders})
        ) AS ag_filter ON ag_filter.audio_id = a.id`,
            genreIds // ← values bound to the placeholders above
        )
    }

    // ── mood filter ────────────────────────────────────────────
    private static applyMoods(query: AudioQuery, { moodIds }: TrackFilterDto) {
        if (moodIds.length === 0) return

        const placeholders = moodIds.map(() => '?').join(', ')

        query.joinRaw(
            `INNER JOIN (
            SELECT DISTINCT audio_id
            FROM audio_moods
            WHERE mood_id IN (${placeholders})
        ) AS am_filter ON am_filter.audio_id = a.id`,
            moodIds
        )
    }

    // ── artist filter ──────────────────────────────────────────
    private static applyArtist(query: AudioQuery, { artistId }: TrackFilterDto) {
        if (!artistId) return
        query.where('a.seller_id', artistId)
    }

    // ── duration filter ────────────────────────────────────────
    private static applyDuration(query: AudioQuery, { minDuration, maxDuration }: TrackFilterDto) {
        if (minDuration !== null) query.where('a.duration', '>=', minDuration)
        if (maxDuration !== null) query.where('a.duration', '<=', maxDuration)
    }

    private static applySort(query: AudioQuery, { sortBy, sortOrder }: TrackFilterDto) {
        if (sortBy === 'random') {
            // RAND() — fine for small-medium datasets
            // for 300k+ rows use a seed-based approach instead
            query.orderByRaw('RAND()')
            return
        }
        query.orderBy(`a.${sortBy}`, sortOrder).orderBy('a.id', sortOrder) // tiebreaker for stable pagination
    }

    private static applyCursor(
        query: AudioQuery,
        { sortBy, cursorCreatedAt, cursorId }: TrackFilterDto
    ) {
        if (sortBy !== 'created_at') return
        if (!cursorCreatedAt || !cursorId) return

        query.where((q) => {
            q.where('a.created_at', '<', cursorCreatedAt).orWhere((q2) => {
                q2.where('a.created_at', '=', cursorCreatedAt).where('a.id', '<', Number(cursorId))
            })
        })
    }
    static async getTotalCount(dto: TrackFilterDto): Promise<number> {
        const query = Audio.query()
            .from('audio as a')
            .where('a.status', 'approve')
            .whereNull('a.deleted_at')
            .count('a.id as total')

        this.applySearch(query, dto)
        this.applyGenres(query, dto)
        this.applyMoods(query, dto)
        this.applyArtist(query, dto)
        this.applyDuration(query, dto)

        const result = await query.first()
        return Number(result?.$extras.total ?? 0)
    }
}
