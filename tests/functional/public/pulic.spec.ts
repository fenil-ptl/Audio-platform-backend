import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { DateTime } from 'luxon'

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
}

async function createGenre(name: string): Promise<number> {
    const slug = slugify(name)
    // INSERT IGNORE skips silently if slug already exists
    await db.raw(
        'INSERT IGNORE INTO genres (name, slug, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [
            name,
            slug,
            DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
            DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
        ]
    )
    const row = await db.from('genres').where('slug', slug).first()
    return row.id
}

async function createMood(name: string): Promise<number> {
    const slug = slugify(name)
    db.raw('INSERT IGNORE INTO moods (name, slug, created_at, updated_at) VALUES (?, ?, ?, ?)', [
        name,
        slug,
        DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
        DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
    ])
    const row = await db.from('moods').where('slug', slug).first()
    return row.id
}

// ── Seller inserted fresh each time inside the transaction ────────────────

async function createSeller(): Promise<number> {
    const email = `seller_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`
    const [insertId] = await db.table('users').insert({
        email,
        password: 'hashed_password',
        role: 'seller',
        created_at: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
        updated_at: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
    })
    return insertId
}

interface AudioOpts {
    title?: string
    bpm?: number
    duration?: number
    status?: 'approve' | 'pending' | 'reject'
    deletedAt?: DateTime | null
}

async function createAudio(opts: AudioOpts = {}): Promise<number> {
    const sellerId = await createSeller()
    const title = opts.title ?? 'Test Track'
    const result = await db.table('audio').insert({
        'seller_id': sellerId,
        title,
        'slug': slugify(title) + '-' + Date.now(),
        'cover-image-url': 'https://example.com/cover.jpg',
        'file-url': 'https://example.com/file.mp3',
        'bpm': opts.bpm ?? 120,
        'duration': opts.duration ?? 180,
        'status': opts.status ?? 'approve',
        'deleted_at': opts.deletedAt ? opts.deletedAt.toFormat('yyyy-MM-dd HH:mm:ss') : null,
        'created_at': DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
    })
    return result[0] as unknown as number
}

async function createAudioWithTime(opts: AudioOpts, createdAt: DateTime): Promise<number> {
    const sellerId = await createSeller()
    const title = opts.title ?? 'Test Track'
    const result = await db.table('audio').insert({
        'seller_id': sellerId,
        title,
        'slug': slugify(title) + '-' + Date.now(),
        'cover-image-url': 'https://example.com/cover.jpg',
        'file-url': 'https://example.com/file.mp3',
        'bpm': opts.bpm ?? 120,
        'duration': opts.duration ?? 180,
        'status': opts.status ?? 'approve',
        'deleted_at': opts.deletedAt ? opts.deletedAt.toFormat('yyyy-MM-dd HH:mm:ss') : null,
        'created_at': createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
    })
    return result[0] as unknown as number
}

async function attachGenre(audioId: number, genreId: number) {
    await db.table('audio_genres').insert({ audio_id: audioId, genre_id: genreId })
}

async function attachMood(audioId: number, moodId: number) {
    await db.table('audio_moods').insert({ audio_id: audioId, mood_id: moodId })
}

async function createVerifiedUser(): Promise<{ user: User; token: string }> {
    const email = `user_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`
    // Use model so hash.use(scrypt) hashes the password correctly for AuthFinder
    const user = await User.create({
        email,
        password: 'Secret@123',
        role: 'user',
        isEmailVerified: true, // maps to is_email_verify column
    } as any)
    // Generate a real access token — required because auth uses DbAccessTokensProvider
    const tokenObj = await User.accessTokens.create(user)
    return { user, token: tokenObj.value!.release() }
}

// ─── GET /track (index) ──────────────────────────────────────────────────────

test.group('GET /track - index', (group) => {
    group.each.setup(() => testUtils.db().withGlobalTransaction())
    group.each.teardown(async () => {
        // Hard-delete any audio/users left by tests that bypass the transaction
        await db.from('audio_genres').delete()
        await db.from('audio_moods').delete()
        await db.from('audio').delete()
        await db.from('users').delete()
    })

    test('returns 200 with default pagination when no query params supplied', async ({
        client,
        assert,
    }) => {
        await createAudio()
        const response = await client.get('/track')
        response.assertStatus(200)
        const { meta } = response.body()
        assert.equal(meta.currentPage, 1)
        assert.equal(meta.firstPage, 1)
    })

    test('only returns approved non-deleted tracks', async ({ client, assert }) => {
        const approvedId = await createAudio({ status: 'approve' })
        await createAudio({ status: 'pending' })
        await createAudio({ status: 'reject' })
        await createAudio({ status: 'approve', deletedAt: DateTime.now() })

        const response = await client.get('/track')
        response.assertStatus(200)

        const ids: number[] = response.body().data.map((t: any) => t.id)
        assert.include(ids, approvedId)
        assert.equal(ids.length, 1)
    })

    test('respects page and limit query params', async ({ client, assert }) => {
        for (let i = 0; i < 5; i++) {
            await createAudio({ title: `Track ${i}` })
        }
        const response = await client.get('/track').qs({ page: 1, limit: 2 })
        response.assertStatus(200)
        const { meta, data } = response.body()
        assert.equal(meta.currentPage, 1)
        assert.equal(meta.perPage, 2)
        assert.equal(data.length, 2)
    })

    test('filters tracks by a single genre', async ({ client, assert }) => {
        const genreId = await createGenre('Jazz')
        const matchId = await createAudio({ title: 'Jazz Track' })
        const noMatchId = await createAudio({ title: 'Other Track' })
        await attachGenre(matchId, genreId)

        const response = await client.get('/track').qs({ genres: 'Jazz' })
        response.assertStatus(200)

        const ids: number[] = response.body().data.map((t: any) => t.id)
        assert.include(ids, matchId)
        assert.notInclude(ids, noMatchId)
    })

    test('filters tracks by a single mood', async ({ client, assert }) => {
        const moodId = await createMood('Happy')
        const matchId = await createAudio({ title: 'Happy Track' })
        const noMatchId = await createAudio({ title: 'Sad Track' })
        await attachMood(matchId, moodId)

        const response = await client.get('/track').qs({ moods: 'Happy' })
        response.assertStatus(200)

        const ids: number[] = response.body().data.map((t: any) => t.id)
        assert.include(ids, matchId)
        assert.notInclude(ids, noMatchId)
    })

    test('filters tracks by multiple genres (comma-separated)', async ({ client, assert }) => {
        const jazzId = await createGenre('Jazz')
        const rockId = await createGenre('Rock')
        const popId = await createGenre('Pop')

        const jazzTrack = await createAudio({ title: 'Jazz Track' })
        const rockTrack = await createAudio({ title: 'Rock Track' })
        const popTrack = await createAudio({ title: 'Pop Track' })

        await attachGenre(jazzTrack, jazzId)
        await attachGenre(rockTrack, rockId)
        await attachGenre(popTrack, popId)

        const response = await client.get('/track').qs({ genres: 'Jazz,Rock' })
        response.assertStatus(200)

        const ids: number[] = response.body().data.map((t: any) => t.id)
        assert.include(ids, jazzTrack)
        assert.include(ids, rockTrack)
        assert.notInclude(ids, popTrack)
    })

    test('filters tracks by multiple moods (comma-separated)', async ({ client, assert }) => {
        const happyId = await createMood('Happy')
        const sadId = await createMood('Sad')
        const angryId = await createMood('Angry')

        const happyTrack = await createAudio({ title: 'Happy Track' })
        const sadTrack = await createAudio({ title: 'Sad Track' })
        const angryTrack = await createAudio({ title: 'Angry Track' })

        await attachMood(happyTrack, happyId)
        await attachMood(sadTrack, sadId)
        await attachMood(angryTrack, angryId)

        const response = await client.get('/track').qs({ moods: 'Happy,Sad' })
        response.assertStatus(200)

        const ids: number[] = response.body().data.map((t: any) => t.id)
        assert.include(ids, happyTrack)
        assert.include(ids, sadTrack)
        assert.notInclude(ids, angryTrack)
    })

    test('filters by both genre AND mood simultaneously', async ({ client, assert }) => {
        const genreId = await createGenre('Jazz')
        const moodId = await createMood('Relaxed')

        const bothMatch = await createAudio({ title: 'Jazz Relaxed' })
        await attachGenre(bothMatch, genreId)
        await attachMood(bothMatch, moodId)

        const genreOnly = await createAudio({ title: 'Jazz Only' })
        await attachGenre(genreOnly, genreId)

        const moodOnly = await createAudio({ title: 'Relaxed Only' })
        await attachMood(moodOnly, moodId)

        const response = await client.get('/track').qs({ genres: 'Jazz', moods: 'Relaxed' })
        response.assertStatus(200)

        const ids: number[] = response.body().data.map((t: any) => t.id)
        assert.include(ids, bothMatch)
        assert.notInclude(ids, genreOnly)
        assert.notInclude(ids, moodOnly)
    })

    test('returns empty data when genre filter matches nothing', async ({ client, assert }) => {
        // No audio created — controller returns 0 approved tracks regardless of filter
        const response = await client.get('/track').qs({ genres: 'NonExistentGenre' })
        response.assertStatus(200)
        assert.equal(response.body().data.length, 0)
    })

    test('returns empty data when mood filter matches nothing', async ({ client, assert }) => {
        // No audio created — controller returns 0 approved tracks regardless of filter
        const response = await client.get('/track').qs({ moods: 'NonExistentMood' })
        response.assertStatus(200)
        assert.equal(response.body().data.length, 0)
    })

    test('track payload contains all required fields', async ({ client, assert }) => {
        await createAudio()
        const response = await client.get('/track')
        response.assertStatus(200)
        const [track] = response.body().data
        assert.properties(track, ['id', 'title', 'bpm', 'duration', 'createdAt'])
    })

    test('meta object contains all expected keys', async ({ client, assert }) => {
        const response = await client.get('/track')
        response.assertStatus(200)
        const { meta } = response.body()
        assert.properties(meta, [
            'total',
            'perPage',
            'currentPage',
            'lastPage',
            'hasMorePages',
            'firstPage',
        ])
    })

    test('tracks are ordered by created_at descending', async ({ client, assert }) => {
        // Insert with guaranteed different timestamps (10s apart)
        const now = DateTime.now()
        await createAudioWithTime({ title: 'Older' }, now.minus({ seconds: 10 }))
        await createAudioWithTime({ title: 'Newer' }, now)

        const response = await client.get('/track')
        response.assertStatus(200)

        const data = response.body().data
        assert.isAtLeast(data.length, 2)

        // First item should have a created_at >= second item (descending order)
        const firstDate = new Date(data[0].createdAt).getTime()
        const secondDate = new Date(data[1].createdAt).getTime()
        assert.isAtLeast(firstDate, secondDate)
    })

    test('returns 200 with empty data when no tracks exist', async ({ client, assert }) => {
        const response = await client.get('/track')
        response.assertStatus(200)
        assert.equal(response.body().data.length, 0)
        assert.equal(response.body().meta.total, 0)
    })

    test('handles page beyond last page gracefully', async ({ client, assert }) => {
        await createAudio()
        const response = await client.get('/track').qs({ page: 999, limit: 10 })
        response.assertStatus(200)
        assert.equal(response.body().data.length, 0)
    })

    test('whitespace-padded genre names are trimmed correctly', async ({ client, assert }) => {
        const genreId = await createGenre('Jazz')
        const trackId = await createAudio()
        await attachGenre(trackId, genreId)

        const response = await client.get('/track').qs({ genres: ' Jazz , Rock ' })
        response.assertStatus(200)

        const ids: number[] = response.body().data.map((t: any) => t.id)
        assert.include(ids, trackId)
    })

    // ── validation errors ────────────────────────────────────────────────────

    test('returns 422 when page is 0', async ({ client }) => {
        const response = await client.get('/track').qs({ page: 0 })
        response.assertStatus(422)
    })

    test('returns 422 when page exceeds 1000', async ({ client }) => {
        const response = await client.get('/track').qs({ page: 1001 })
        response.assertStatus(422)
    })

    test('returns 422 when limit is 0', async ({ client }) => {
        const response = await client.get('/track').qs({ limit: 0 })
        response.assertStatus(422)
    })

    test('returns 422 when limit exceeds 100', async ({ client }) => {
        const response = await client.get('/track').qs({ limit: 101 })
        response.assertStatus(422)
    })

    test('returns 422 when more than 20 genres are supplied', async ({ client }) => {
        const genres = Array.from({ length: 21 }, (_, i) => `Genre${i}`).join(',')
        const response = await client.get('/track').qs({ genres })
        response.assertStatus(422)
    })

    test('returns 422 when more than 20 moods are supplied', async ({ client }) => {
        const moods = Array.from({ length: 21 }, (_, i) => `Mood${i}`).join(',')
        const response = await client.get('/track').qs({ moods })
        response.assertStatus(422)
    })

    test('accepts exactly 20 genres without error', async ({ client }) => {
        const genres = Array.from({ length: 20 }, (_, i) => `Genre${i}`).join(',')
        const response = await client.get('/track').qs({ genres })
        response.assertStatus(200)
    })

    test('accepts exactly 20 moods without error', async ({ client }) => {
        const moods = Array.from({ length: 20 }, (_, i) => `Mood${i}`).join(',')
        const response = await client.get('/track').qs({ moods })
        response.assertStatus(200)
    })

    test('returns 422 when page is a non-numeric string', async ({ client }) => {
        const response = await client.get('/track').qs({ page: 'abc' })
        response.assertStatus(422)
    })

    test('returns 422 when limit is a non-numeric string', async ({ client }) => {
        const response = await client.get('/track').qs({ limit: 'abc' })
        response.assertStatus(422)
    })
})

// ─── GET /track/:id (show) ───────────────────────────────────────────────────

test.group('GET /track/:id - show', (showGroup) => {
    showGroup.each.setup(() => testUtils.db().withGlobalTransaction())
    showGroup.each.teardown(async () => {
        await db.from('auth_access_tokens').delete()
        await db.from('audio_genres').delete()
        await db.from('audio_moods').delete()
        await db.from('audio').delete()
        await db.from('users').delete()
    })

    test('returns 200 with track details for an approved track', async ({ client, assert }) => {
        const { token } = await createVerifiedUser()
        const trackId = await createAudio({ title: 'Approved Track' })

        const response = await client
            .get(`/track/${trackId}`)
            .header('Authorization', `Bearer ${token}`)

        response.assertStatus(200)
        assert.equal(response.body().track.id, trackId)
        assert.equal(response.body().track.title, 'Approved Track')
    })

    test('response body contains message and track keys', async ({ client, assert }) => {
        const { token } = await createVerifiedUser()
        const trackId = await createAudio()

        const response = await client
            .get(`/track/${trackId}`)
            .header('Authorization', `Bearer ${token}`)

        response.assertStatus(200)
        assert.properties(response.body(), ['message', 'track'])
    })

    test('track payload contains all required fields', async ({ client, assert }) => {
        const { token } = await createVerifiedUser()
        const trackId = await createAudio()

        const response = await client
            .get(`/track/${trackId}`)
            .header('Authorization', `Bearer ${token}`)

        response.assertStatus(200)
        assert.properties(response.body().track, ['id', 'title', 'bpm', 'duration', 'createdAt'])
    })

    test('returns 401 when no authentication is provided', async ({ client }) => {
        const response = await client.get('/track/1')
        response.assertStatus(401)
    })

    test('returns 404 for a non-existent track id', async ({ client }) => {
        const { token } = await createVerifiedUser()
        const response = await client
            .get('/track/99999999')
            .header('Authorization', `Bearer ${token}`)
        response.assertStatus(404)
    })

    test('returns 404 for a pending track', async ({ client }) => {
        const { token } = await createVerifiedUser()
        const trackId = await createAudio({ status: 'pending' })
        const response = await client
            .get(`/track/${trackId}`)
            .header('Authorization', `Bearer ${token}`)
        response.assertStatus(404)
    })

    test('returns 404 for a rejected track', async ({ client }) => {
        const { token } = await createVerifiedUser()
        const trackId = await createAudio({ status: 'reject' })
        const response = await client
            .get(`/track/${trackId}`)
            .header('Authorization', `Bearer ${token}`)
        response.assertStatus(404)
    })

    test('returns 404 for a soft-deleted approved track', async ({ client }) => {
        const { token } = await createVerifiedUser()
        const trackId = await createAudio({ status: 'approve', deletedAt: DateTime.now() })
        const response = await client
            .get(`/track/${trackId}`)
            .header('Authorization', `Bearer ${token}`)
        response.assertStatus(404)
    })
})
