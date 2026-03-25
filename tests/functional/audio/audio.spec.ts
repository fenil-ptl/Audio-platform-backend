// import { test } from '@japa/runner'
// import testUtils from '@adonisjs/core/services/test_utils'
// import app from '@adonisjs/core/services/app'
// import db from '@adonisjs/lucid/services/db'
// import User from '#models/user'
// import Audio from '#models/audio'
// import Genre from '#models/genre'
// import Mood from '#models/mood'
// import FileService from '#services/file_service'
// import path from 'node:path'
// import fs from 'node:fs'
// import os from 'node:os'

// // ─── Helpers ─────────────────────────────────────────────────────────────────

// let counter = 0

// /**
//  * Insert user via raw DB to guarantee is_email_verify=1 is written.
//  * User.create() has silently failed to write boolean columns in some setups.
//  */
// async function createUser(
//     overrides: Partial<{
//         role: 'seller' | 'user' | 'admin'
//     }> = {}
// ): Promise<User> {
//     counter++
//     const now = new Date()
//     // Use hash service to hash the password the same way the model does
//     const hashedPassword = await import('@adonisjs/core/services/hash').then((m) =>
//         m.default.make('password')
//     )
//     const [id] = await db.table('users').insert({
//         full_name: `Test User ${counter}`,
//         email: `user${counter}@test.com`,
//         password: hashedPassword,
//         role: overrides.role ?? 'seller',
//         is_email_verify: 1, // raw column name, guaranteed to be written
//         created_at: now,
//         updated_at: now,
//     })
//     return User.findOrFail(id)
// }

// /**
//  * Raw insert that uses the ACTUAL DB column names verified from migration:
//  *   imageUrl  → image_url        (model decorator says cover_image_url but DB has image_url)
//  *   fileUrl   → file_url         (@column({ columnName: 'file_url' }))
//  *   deletedAt → deleted_at
//  */
// async function createAudio(
//     sellerId: number,
//     overrides: Partial<{
//         slug: string
//         status: string
//         deletedAt: Date | null
//     }> = {}
// ): Promise<Audio> {
//     counter++
//     const now = new Date()
//     const [id] = await db.table('audio').insert({
//         'title': `Track ${counter}`,
//         'slug': overrides.slug ?? `track-slug-${counter}`,
//         'bpm': 128,
//         'duration': 180,
//         'file-url': 'test/dummy.mp3',
//         'cover-image-url': 'test/dummy.jpg',
//         'seller_id': sellerId,
//         'status': overrides.status ?? 'pending',
//         'deleted_at': overrides.deletedAt ?? null,
//         'created_at': now,
//     })
//     return Audio.findOrFail(id)
// }

// function makeTempFile(name: string): string {
//     const p = path.join(os.tmpdir(), name)
//     fs.writeFileSync(p, 'fake-data')
//     return p
// }

// /**
//  * Manually truncate with FK checks disabled so tables can be wiped
//  * in any order without constraint errors.
//  */
// function sharedSetup(group: any) {
//     group.each.setup(async () => {
//         await db.rawQuery('SET FOREIGN_KEY_CHECKS=0')
//         await testUtils.db().truncate()
//         await db.rawQuery('SET FOREIGN_KEY_CHECKS=1')
//     })

//     let restore: () => void
//     group.setup(() => {
//         const fake = {
//             uploadAudio: async (_f: any, _id: number) => ({ path: 'audio/mocked.mp3' }),
//             uploadImage: async (_f: any, _id: number) => ({ path: 'image/mocked.jpg' }),
//             delete: async (_p: string) => {},
//         }
//         app.container.swap(FileService, () => fake as unknown as FileService)
//         restore = () => app.container.restore(FileService)
//     })
//     group.teardown(() => restore?.())
// }

// // ═════════════════════════════════════════════════════════════════════════════
// // store — POST /seller/track
// // ═════════════════════════════════════════════════════════════════════════════

// test.group('store | returns 401 when unauthenticated', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const res = await client.post('/seller/track')
//         res.assertStatus(401)
//     })
// })

// test.group('store | returns 403 when user role is not seller', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const buyer = await createUser({ role: 'user' })
//         const res = await client.post('/seller/track').loginAs(buyer).json({})
//         res.assertStatus(403)
//     })
// })

// test.group('store | returns 422 when required fields are missing', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const res = await client.post('/seller/track').loginAs(seller).json({})
//         res.assertStatus(422)
//     })
// })

// test.group('store | returns 422 when slug is shorter than 5 chars', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const genre = await Genre.create({ name: 'Hip Hop', slug: 'hip-hop' })
//         const mood = await Mood.create({ name: 'Chill', slug: 'chill' })

//         const res = await client
//             .post('/seller/track')
//             .loginAs(seller)
//             .field('title', 'Test Track')
//             .field('slug', 'abc')
//             .field('bpm', '120')
//             .field('duration', '180')
//             .field('genreId[]', String(genre.id))
//             .field('moodId[]', String(mood.id))
//             .file('fileUrl', makeTempFile('s_audio.mp3'), { contentType: 'audio/mpeg' })
//             .file('imageUrl', makeTempFile('s_image.jpg'), { contentType: 'image/jpeg' })

//         res.assertStatus(422)
//     })
// })

// test.group('store | returns 409 when slug is already taken', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const genre = await Genre.create({ name: 'Pop', slug: 'pop' })
//         const mood = await Mood.create({ name: 'Happy', slug: 'happy' })
//         await createAudio(seller.id, { slug: 'my-cool-slug' })

//         const res = await client
//             .post('/seller/track')
//             .loginAs(seller)
//             .field('title', 'Another Track')
//             .field('slug', 'my-cool-slug')
//             .field('bpm', '128')
//             .field('duration', '200')
//             .field('genreId[]', String(genre.id))
//             .field('moodId[]', String(mood.id))
//             .file('fileUrl', makeTempFile('dup_audio.mp3'), { contentType: 'audio/mpeg' })
//             .file('imageUrl', makeTempFile('dup_image.jpg'), { contentType: 'image/jpeg' })

//         res.assertStatus(409)
//     })
// })

// test.group('store | creates a track and returns 200', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         const genre = await Genre.create({ name: 'Jazz', slug: 'jazz' })
//         const mood = await Mood.create({ name: 'Calm', slug: 'calm' })

//         const res = await client
//             .post('/seller/track')
//             .loginAs(seller)
//             .field('title', 'My New Track')
//             .field('slug', 'my-new-track')
//             .field('bpm', '140')
//             .field('duration', '240')
//             .field('genreId[]', String(genre.id))
//             .field('moodId[]', String(mood.id))
//             .file('fileUrl', makeTempFile('ok_audio.mp3'), { contentType: 'audio/mpeg' })
//             .file('imageUrl', makeTempFile('ok_image.jpg'), { contentType: 'image/jpeg' })

//         res.assertStatus(200)
//         res.assertBodyContains({ data: { title: 'My New Track', slug: 'my-new-track' } })

//         const dbTrack = await Audio.query()
//             .where('slug', 'my-new-track')
//             .where('seller_id', seller.id)
//             .first()
//         assert.isNotNull(dbTrack)
//         assert.equal(dbTrack!.status, 'pending')
//     })
// })

// // ═════════════════════════════════════════════════════════════════════════════
// // index — GET /seller/track
// // ═════════════════════════════════════════════════════════════════════════════

// test.group('index | returns 401 when unauthenticated', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const res = await client.get('/seller/track')
//         res.assertStatus(401)
//     })
// })

// test.group('index | returns only the current sellers tracks', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         await createAudio(seller.id)
//         await createAudio(seller.id)
//         await createAudio(seller.id)
//         const other = await createUser()
//         await createAudio(other.id)

//         const res = await client.get('/seller/track').loginAs(seller)
//         res.assertStatus(200)
//         assert.equal(res.body().data.length, 3)
//     })
// })

// test.group('index | does not return soft-deleted tracks', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         await createAudio(seller.id)
//         await createAudio(seller.id)
//         const deleted = await createAudio(seller.id, { deletedAt: new Date() })

//         const res = await client.get('/seller/track').loginAs(seller)
//         res.assertStatus(200)

//         const ids = res.body().data.map((d: any) => d.id)
//         assert.notInclude(ids, deleted.id)
//         assert.equal(ids.length, 2)
//     })
// })

// test.group('index | paginates with page and limit params', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         for (let i = 0; i < 15; i++) await createAudio(seller.id)

//         const res = await client.get('/seller/track').loginAs(seller).qs({ page: 2, limit: 5 })
//         res.assertStatus(200)
//         assert.equal(res.body().data.length, 5)
//         assert.equal(res.body().meta.current_page, 2)
//     })
// })

// test.group('index | returns 422 for invalid pagination params', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const res = await client.get('/seller/track').loginAs(seller).qs({ page: -1 })
//         res.assertStatus(422)
//     })
// })

// // ═════════════════════════════════════════════════════════════════════════════
// // show — GET /seller/track/:id
// // ═════════════════════════════════════════════════════════════════════════════

// test.group('show | returns 401 when unauthenticated', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const res = await client.get('/seller/track/1')
//         res.assertStatus(401)
//     })
// })

// test.group('show | returns 404 when track belongs to another seller', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const other = await createUser()
//         const audio = await createAudio(other.id)

//         const res = await client.get(`/seller/track/${audio.id}`).loginAs(seller)
//         res.assertStatus(404)
//     })
// })

// test.group('show | returns 404 for non-existent id', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const res = await client.get('/seller/track/99999999').loginAs(seller)
//         res.assertStatus(404)
//     })
// })

// test.group('show | returns track with genres and moods preloaded', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         const genre = await Genre.create({ name: 'Electronic', slug: 'electronic' })
//         const mood = await Mood.create({ name: 'Energetic', slug: 'energetic' })
//         const audio = await createAudio(seller.id)
//         await audio.related('genres').attach([genre.id])
//         await audio.related('moods').attach([mood.id])

//         const res = await client.get(`/seller/track/${audio.id}`).loginAs(seller)
//         res.assertStatus(200)

//         const data = res.body().data
//         assert.equal(data.id, audio.id)
//         assert.isArray(data.genres)
//         assert.isArray(data.moods)
//         assert.equal(data.genres[0].id, genre.id)
//         assert.equal(data.moods[0].id, mood.id)
//     })
// })

// // ═════════════════════════════════════════════════════════════════════════════
// // update — PATCH /seller/track/:id
// // ═════════════════════════════════════════════════════════════════════════════

// test.group('update | returns 401 when unauthenticated', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const res = await client.patch('/seller/track/1').json({})
//         res.assertStatus(401)
//     })
// })

// test.group('update | returns 404 when track belongs to another seller', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const other = await createUser()
//         const audio = await createAudio(other.id)

//         const res = await client
//             .patch(`/seller/track/${audio.id}`)
//             .loginAs(seller)
//             .field('title', 'Hacked Title')

//         res.assertStatus(404)
//     })
// })

// test.group('update | returns 422 when no fields are provided', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const audio = await createAudio(seller.id)

//         const res = await client.patch(`/seller/track/${audio.id}`).loginAs(seller).json({})
//         res.assertStatus(422)
//     })
// })

// test.group('update | returns 409 when slug is already taken by another track', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         await createAudio(seller.id, { slug: 'taken-slug' })
//         const audio = await createAudio(seller.id, { slug: 'original-slug' })

//         const res = await client
//             .patch(`/seller/track/${audio.id}`)
//             .loginAs(seller)
//             .field('slug', 'taken-slug')

//         res.assertStatus(409)
//     })
// })

// test.group('update | allows updating to same slug without conflict', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const audio = await createAudio(seller.id, { slug: 'my-slug' })

//         const res = await client
//             .patch(`/seller/track/${audio.id}`)
//             .loginAs(seller)
//             .field('slug', 'my-slug')
//             .field('title', 'Updated Title')

//         res.assertStatus(200)
//     })
// })

// test.group('update | updates title and resets status to pending', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         const audio = await createAudio(seller.id, { status: 'approve' })

//         const res = await client
//             .patch(`/seller/track/${audio.id}`)
//             .loginAs(seller)
//             .field('title', 'Updated Title')

//         res.assertStatus(200)
//         res.assertBodyContains({ data: { title: 'Updated Title', status: 'pending' } })

//         const reloaded = await Audio.find(audio.id)
//         assert.equal(reloaded!.title, 'Updated Title')
//         assert.equal(reloaded!.status, 'pending')
//     })
// })

// test.group('update | updates audio file successfully', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const audio = await createAudio(seller.id)

//         const res = await client
//             .patch(`/seller/track/${audio.id}`)
//             .loginAs(seller)
//             .file('fileUrl', makeTempFile('new_audio.mp3'), { contentType: 'audio/mpeg' })

//         res.assertStatus(200)
//     })
// })

// test.group('update | syncs genres and removes old ones', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         const g1 = await Genre.create({ name: 'Rock', slug: 'rock' })
//         const g2 = await Genre.create({ name: 'Soul', slug: 'soul' })
//         const audio = await createAudio(seller.id)
//         await audio.related('genres').attach([g1.id])

//         const res = await client
//             .patch(`/seller/track/${audio.id}`)
//             .loginAs(seller)
//             .field('genreId[]', String(g2.id))

//         res.assertStatus(200)

//         await audio.load('genres')
//         const genreIds = audio.genres.map((g: Genre) => g.id)
//         assert.deepEqual(genreIds, [g2.id])
//     })
// })

// // ═════════════════════════════════════════════════════════════════════════════
// // destroy — DELETE /seller/track/:id
// // ═════════════════════════════════════════════════════════════════════════════

// test.group('destroy | returns 401 when unauthenticated', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const res = await client.delete('/seller/track/1')
//         res.assertStatus(401)
//     })
// })

// test.group('destroy | returns 404 when track belongs to another seller', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const other = await createUser()
//         const audio = await createAudio(other.id)

//         const res = await client.delete(`/seller/track/${audio.id}`).loginAs(seller)
//         res.assertStatus(404)
//     })
// })

// test.group('destroy | returns 404 for an already soft-deleted track', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client }) => {
//         const seller = await createUser()
//         const audio = await createAudio(seller.id, { deletedAt: new Date() })

//         const res = await client.delete(`/seller/track/${audio.id}`).loginAs(seller)
//         res.assertStatus(404)
//     })
// })

// test.group('destroy | soft-deletes track and sets deletedAt in DB', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         const audio = await createAudio(seller.id)

//         const res = await client.delete(`/seller/track/${audio.id}`).loginAs(seller)
//         res.assertStatus(200)

//         const row = await Audio.query().where('id', audio.id).first()
//         assert.isNotNull(row?.deletedAt)
//     })
// })

// test.group('destroy | soft-deleted track no longer appears in index', (group) => {
//     sharedSetup(group)
//     test('it', async ({ client, assert }) => {
//         const seller = await createUser()
//         const audio = await createAudio(seller.id)

//         await client.delete(`/seller/track/${audio.id}`).loginAs(seller)

//         const indexRes = await client.get('/seller/track').loginAs(seller)
//         const ids = indexRes.body().data.map((d: any) => d.id)
//         assert.notInclude(ids, audio.id)
//     })
// })
