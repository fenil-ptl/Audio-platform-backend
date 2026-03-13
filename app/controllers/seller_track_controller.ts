import FileService from '#services/file_service'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Audio from '#models/audio'

@inject()
export default class AudioController {
    constructor(private fileService: FileService) {}

    async store({ request, auth, i18n }: HttpContext) {
        const user = auth.user!

        const payload = await request.validateUsing(
            vine.compile(
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
        )

        const existingSlug = await Audio.query().where('slug', payload.slug).select('id').first()

        if (existingSlug) {
            throw new Exception(i18n.t('messages.track.slug_taken'), { status: 409 })
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
            message: i18n.t('messages.track.created'),
            data: audio.serialize(),
        }
    }

    async index({ auth, request }: HttpContext) {
        const { page, limit } = await request.validateUsing(
            vine.compile(
                vine.object({
                    page: vine.number().positive().min(1).max(1000),
                    limit: vine.number().positive().min(1).max(100),
                })
            )
        )

        const audios = await Audio.query()
            .where('seller_id', auth.user!.id)
            .whereNull('deleted_at')
            .select('id', 'title', 'bpm', 'duration', 'status', 'created_at')
            .orderBy('created_at', 'desc')
            .paginate(page, limit)

        return audios.toJSON()
    }

    async show({ params, auth, i18n }: HttpContext) {
        const audio = await Audio.query()
            .where('id', Number(params.id))
            .where('seller_id', auth.user!.id)
            .whereNull('deleted_at')
            .select(
                'id',
                'title',
                'bpm',
                'duration',
                'status',
                'file_url',
                'image_url',
                'created_at',
                'updated_at'
            )
            .first()

        if (!audio) {
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }

        return {
            message: i18n.t('messages.track.fetched'),
            data: audio.serialize(),
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
            throw new Exception(i18n.t('messages.track.not_found'), { status: 404 })
        }

        audio.deletedAt = DateTime.now()
        await audio.save()

        return {
            message: i18n.t('messages.track.deleted'),
        }
    }
}
