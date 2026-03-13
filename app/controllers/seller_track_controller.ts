import FileService from '#services/file_service'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Audio from '#models/audio'

const storeValidator = vine.compile(
    vine.object({
        title: vine.string().trim().minLength(3),
        slug: vine.string().trim().minLength(5).alphaNumeric({ allowDashes: true }),
        bpm: vine.number().positive(),
        duration: vine.number().positive(),
        genreId: vine.array(vine.number().positive()).minLength(1),
        moodId: vine.array(vine.number().positive()).minLength(1),
        fileUrl: vine.file({ size: '5mb', extnames: ['mp3', 'm4a'] }),
        imageUrl: vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png'] }),
    })
)

const paginationValidator = vine.compile(
    vine.object({
        page: vine.number().positive().min(1).max(1000).optional(),
        limit: vine.number().positive().min(1).max(100).optional(),
    })
)

const updateValidator = vine.compile(
    vine.object({
        title: vine.string().trim().minLength(3).optional(),
        slug: vine.string().trim().minLength(5).alphaNumeric({ allowDashes: true }).optional(),
        bpm: vine.number().positive().optional(),
        duration: vine.number().positive().optional(),
        genreId: vine.array(vine.number().positive()).minLength(1).optional(),
        moodId: vine.array(vine.number().positive()).minLength(1).optional(),
        fileUrl: vine.file({ size: '5mb', extnames: ['mp3', 'm4a'] }).optional(),
        imageUrl: vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png'] }).optional(),
    })
)

@inject()
export default class AudioController {
    constructor(private fileService: FileService) {}

    async store({ request, auth, i18n }: HttpContext) {
        const user = auth.user!
        const payload = await request.validateUsing(storeValidator)

        const existingSlug = await Audio.query().where('slug', payload.slug).select('id').first()
        if (existingSlug) {
            throw new Exception(i18n.t('message.track.slug_taken'), { status: 409 })
        }

        const [uploadedAudio, uploadedImage] = await Promise.all([
            this.fileService.uploadAudio(payload.fileUrl, user.id),
            this.fileService.uploadImage(payload.imageUrl, user.id),
        ])

        const audio = await db.transaction(async (trx) => {
            const newAudio = await Audio.create(
                {
                    title: payload.title,
                    slug: payload.slug,
                    bpm: payload.bpm,
                    duration: payload.duration,
                    fileUrl: uploadedAudio.path,
                    imageUrl: uploadedImage.path,
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
            message: i18n.t('message.track.created'),
            data: audio.serialize(),
        }
    }

    async index({ auth, request }: HttpContext) {
        const { page, limit } = await request.validateUsing(paginationValidator)

        const audios = await Audio.query()
            .where('seller_id', auth.user!.id)
            .whereNull('deleted_at')
            .select('id', 'title', 'bpm', 'duration', 'status', 'created_at')
            .orderBy('created_at', 'desc')
            .paginate(page ?? 1, limit ?? 10)

        return audios.toJSON()
    }

    async show({ params, auth, i18n }: HttpContext) {
        const audio = await Audio.query()
            .where('id', Number(params.id))
            .where('seller_id', auth.user!.id)
            .select('id', 'title', 'slug', 'bpm', 'duration', 'status', 'created_at')
            .preload('genres', (q) => q.select('id', 'name', 'slug'))
            .preload('moods', (q) => q.select('id', 'name', 'slug'))
            .first()

        if (!audio) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        return {
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
            .select('id', 'title', 'slug', 'bpm', 'duration', 'status')
            .first()

        if (!audio) {
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }

        const payload = await request.validateUsing(updateValidator)

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
                throw new Exception(i18n.t('messages.track.slug_taken'), { status: 409 })
            }
        }

        let newAudioPath: string | undefined
        let newImagePath: string | undefined

        if (payload.fileUrl) {
            const uploaded = await this.fileService.uploadAudio(payload.fileUrl, user.id)
            // delete old file from tmp (best effort)
            await this.fileService.delete(audio.fileUrl)
            newAudioPath = uploaded.path
        }

        if (payload.imageUrl) {
            const uploaded = await this.fileService.uploadImage(payload.imageUrl, user.id)
            // delete old image from tmp (best effort)
            await this.fileService.delete(audio.imageUrl)
            newImagePath = uploaded.path
        }

        await db.transaction(async (trx) => {
            audio.useTransaction(trx)

            audio.merge({
                ...(payload.title && { title: payload.title }),
                ...(payload.slug && { slug: payload.slug }),
                ...(payload.bpm && { bpm: payload.bpm }),
                ...(payload.duration && { duration: payload.duration }),
                ...(newAudioPath && { fileUrl: newAudioPath }),
                ...(newImagePath && { imageUrl: newImagePath }),
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
            message: i18n.t('message.track.deleted'),
        }
    }
}
