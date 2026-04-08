import FileService from '#services/file_service'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import Audio from '#models/audio'
import AudioDurationService from '#services/audio_duration_service'
import fs from 'node:fs/promises'
import { DateTime } from 'luxon'

@inject()
export default class AudioController {
    constructor(private fileService: FileService) {}

    async store({ request, auth, i18n, ...ctx }: HttpContext) {
        const user = auth.user!
        const limits = (ctx as any).planLimits

        const maxSizeStr = `${limits.maxFileSizeMb}mb`
        const allowedExts = limits.allowedFormats

        // ── 1. Validate request ─────────────────────────────────────────
        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    title: vine.string().trim().minLength(3),
                    slug: vine.string().trim().minLength(5).alphaNumeric({ allowDashes: true }),
                    bpm: vine.number().positive(),
                    genreId: vine.array(vine.number().positive()).minLength(1),
                    moodId: vine.array(vine.number().positive()).minLength(1),
                    fileUrl: vine.file({ size: maxSizeStr, extnames: allowedExts }),
                    imageUrl: vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png'] }),
                })
            )
        )

        // ── 2. Slug uniqueness check ────────────────────────────────────
        const existingSlug = await Audio.query().where('slug', payload.slug).select('id').first()

        if (existingSlug) {
            throw new Exception(i18n.t('message.track.slug_taken'), { status: 409 })
        }

        // ── 3. Move audio to tmp ONCE — ffprobe reads from here ─────────
        // Capture metadata NOW before move() is called, as some fields
        // may not be accessible after the file is moved
        const audioMeta = {
            size: payload.fileUrl.size ?? 0,
            originalName: payload.fileUrl.clientName ?? '',
            mimeType: `${payload.fileUrl.type}/${payload.fileUrl.subtype}`,
        }

        const tmpFilePath = await this.fileService.moveAudioToTmp(payload.fileUrl)

        // ── 4. Extract duration from tmp file ───────────────────────────
        let duration: number

        try {
            duration = await AudioDurationService.getDuration(tmpFilePath)
        } catch (error) {
            console.error('Duration extraction failed:', error)

            await fs.unlink(tmpFilePath).catch((err) => console.warn('Tmp cleanup failed:', err))

            throw new Exception(i18n.t('message.track.invalid_audio'), { status: 400 })
        }

        // ── 5. Move audio to storage + upload image in parallel ─────────
        let uploadedAudio: Awaited<ReturnType<FileService['uploadAudioFromTmp']>> | null = null
        let uploadedImage: Awaited<ReturnType<FileService['uploadImage']>> | null = null

        try {
            ;[uploadedAudio, uploadedImage] = await Promise.all([
                this.fileService.uploadAudioFromTmp(tmpFilePath, user.id, audioMeta),
                this.fileService.uploadImage(payload.imageUrl, user.id),
            ])

            // ── 6. Persist to DB inside a transaction ───────────────────
            const audio = await db.transaction(async (trx) => {
                const newAudio = await Audio.create(
                    {
                        title: payload.title,
                        slug: payload.slug,
                        bpm: payload.bpm,
                        duration,
                        fileUrl: uploadedAudio!.path,
                        imageUrl: uploadedImage!.path,
                        sellerId: user.id,
                        status: 'pending',
                    },
                    { client: trx }
                )

                await Promise.all([
                    newAudio.related('genres').attach(payload.genreId, trx),
                    newAudio.related('moods').attach(payload.moodId, trx),
                ])

                return newAudio
            })

            return {
                success: true,
                message: i18n.t('message.track.created'),
                data: audio.serialize(),
            }
        } catch (error) {
            // ── 7. Clean up storage files if DB transaction failed ──────
            await Promise.allSettled([
                uploadedAudio
                    ? this.fileService.delete(uploadedAudio.path)
                    : fs.unlink(tmpFilePath).catch(() => {}),
                uploadedImage ? this.fileService.delete(uploadedImage.path) : Promise.resolve(),
            ])

            throw error
        }
    }

    async index({ auth, request, i18n }: HttpContext) {
        const { page, limit } = await request.validateUsing(
            vine.compile(
                vine.object({
                    page: vine.number().positive().min(1).max(1000).optional(),
                    limit: vine.number().positive().min(1).max(100).optional(),
                })
            )
        )

        const audios = await Audio.query()
            .where('seller_id', auth.user!.id)
            .whereNull('deleted_at')
            .select('id', 'title', 'bpm', 'duration', 'status', 'created_at')
            .orderBy('created_at', 'desc')
            .paginate(page ?? 1, limit ?? 10)

        return {
            success: true,
            message: i18n.t('seller.track.fetched'),
            data: audios.toJSON(),
        }
    }

    async show({ params, auth, i18n }: HttpContext) {
        const audio = await Audio.query()
            .where('id', Number(params.id))
            .where('seller_id', auth.user!.id)
            .whereNull('deleted_at')
            .select('id', 'title', 'slug', 'bpm', 'duration', 'status', 'created_at')
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .first()

        if (!audio) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        return {
            success: true,
            message: i18n.t('message.track.fetched'),
            data: audio.serialize(),
        }
    }

    // add this method inside the AudioController class
    async update({ params, request, auth, i18n }: HttpContext) {
        const user = auth.user!
        const audioId = Number(params.id)

        const audio = await Audio.query()
            .where('id', audioId)
            .where('seller_id', user.id)
            .whereNull('deleted_at')
            .select(
                'id',
                'title',
                'slug',
                'bpm',
                'duration',
                'status',
                'file_url',
                'cover_image_url'
            )
            .first()

        if (!audio) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    title: vine.string().trim().minLength(3).optional(),
                    slug: vine
                        .string()
                        .trim()
                        .minLength(5)
                        .alphaNumeric({ allowDashes: true })
                        .optional(),
                    bpm: vine.number().positive().optional(),
                    // duration removed — auto-extracted from file if file is uploaded
                    genreId: vine.array(vine.number().positive()).minLength(1).optional(),
                    moodId: vine.array(vine.number().positive()).minLength(1).optional(),
                    fileUrl: vine.file({ size: '50mb', extnames: ['mp3', 'm4a'] }).optional(),
                    imageUrl: vine
                        .file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png'] })
                        .optional(),
                })
            )
        )

        if (Object.keys(payload).length === 0) {
            throw new Exception('No fields provided to update', { status: 422 })
        }

        if (payload.slug && payload.slug !== audio.slug) {
            const slugTaken = await Audio.query()
                .where('slug', payload.slug)
                .whereNot('id', audioId)
                .select('id')
                .first()

            if (slugTaken) {
                throw new Exception(i18n.t('message.track.slug_taken'), { status: 409 })
            }
        }

        let newAudioPath: string | undefined
        let newImagePath: string | undefined
        let newDuration: number | undefined
        let oldAudioPath: string | undefined
        let oldImagePath: string | undefined

        try {
            // ── Handle new audio file ───────────────────────────────────────
            if (payload.fileUrl) {
                // 1. Capture metadata BEFORE move
                const audioMeta = {
                    size: payload.fileUrl.size ?? 0,
                    originalName: payload.fileUrl.clientName ?? '',
                    mimeType: `${payload.fileUrl.type}/${payload.fileUrl.subtype}`,
                }

                // 2. Move to tmp ONCE for ffprobe
                const tmpFilePath = await this.fileService.moveAudioToTmp(payload.fileUrl)

                // 3. Extract duration from tmp file
                try {
                    newDuration = await AudioDurationService.getDuration(tmpFilePath)
                } catch (error) {
                    console.error('Duration extraction failed:', error)

                    await fs
                        .unlink(tmpFilePath)
                        .catch((err) => console.warn('Tmp cleanup failed:', err))

                    throw new Exception(i18n.t('message.track.invalid_audio'), { status: 400 })
                }

                // 4. Move from tmp to final storage using meta object
                const uploaded = await this.fileService.uploadAudioFromTmp(
                    tmpFilePath,
                    user.id,
                    audioMeta // ← third argument, no more TS error
                )

                oldAudioPath = audio.fileUrl
                newAudioPath = uploaded.path
            }

            // ── Handle new image file ───────────────────────────────────────
            if (payload.imageUrl) {
                const uploaded = await this.fileService.uploadImage(payload.imageUrl, user.id)
                oldImagePath = audio.imageUrl
                newImagePath = uploaded.path
            }

            // ── Persist changes in a transaction ───────────────────────────
            await db.transaction(async (trx) => {
                audio.useTransaction(trx)

                audio.merge({
                    ...(payload.title && { title: payload.title }),
                    ...(payload.slug && { slug: payload.slug }),
                    ...(payload.bpm && { bpm: payload.bpm }),
                    ...(newDuration && { duration: newDuration }), // from ffprobe, not user input
                    ...(newAudioPath && { fileUrl: newAudioPath }),
                    ...(newImagePath && { coverImageUrl: newImagePath }),
                    status: 'pending',
                })

                await audio.save()

                if (payload.genreId) {
                    await audio.related('genres').sync(payload.genreId, true, trx)
                }

                if (payload.moodId) {
                    await audio.related('moods').sync(payload.moodId, true, trx)
                }
            })

            // ── Transaction succeeded — delete old files ────────────────────
            await Promise.allSettled([
                oldAudioPath ? this.fileService.delete(oldAudioPath) : Promise.resolve(),
                oldImagePath ? this.fileService.delete(oldImagePath) : Promise.resolve(),
            ])
        } catch (error) {
            // ── Transaction failed — delete newly uploaded files ────────────
            await Promise.allSettled([
                newAudioPath ? this.fileService.delete(newAudioPath) : Promise.resolve(),
                newImagePath ? this.fileService.delete(newImagePath) : Promise.resolve(),
            ])
            throw error
        }

        const updated = await Audio.query()
            .where('id', audioId)
            .select(
                'id',
                'title',
                'slug',
                'bpm',
                'duration',
                'status',
                'file_url',
                'cover_image_url',
                'created_at'
            )
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .firstOrFail()

        return {
            success: true,
            message: i18n.t('message.track.updated'),
            data: updated.serialize(),
        }
    }
    async destroy({ params, auth, i18n }: HttpContext) {
        const audio = await Audio.query()
            .where('id', Number(params.id))
            .where('seller_id', auth.user!.id)
            .whereNull('deleted_at')
            .select('id')
            .first()

        if (!audio) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        audio.deletedAt = DateTime.now()
        await audio.save()

        return {
            success: true,
            message: i18n.t('message.track.deleted'),
            data: null,
        }
    }
}
