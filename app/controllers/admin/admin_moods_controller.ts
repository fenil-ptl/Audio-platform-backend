import Mood from '#models/mood'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export default class AdminMoodsController {
    async createMood({ request, i18n }: HttpContext) {
        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    name: vine.string().trim().minLength(2).maxLength(100),
                    slug: vine.string().trim().minLength(2).maxLength(100),
                })
            )
        )

        const existingSlug = await Mood.query().where('slug', payload.slug).select('id').first()

        if (existingSlug) {
            throw new Exception(i18n.t('message.mood.slug_taken'), { status: 409 })
        }

        const mood = await Mood.create({
            name: payload.name,
            slug: payload.slug,
        })

        return {
            success: true,
            message: i18n.t('message.mood.created'),
            data: mood.serialize({ fields: ['id', 'name', 'slug'] }),
        }
    }

    async editMood({ request, params, i18n }: HttpContext) {
        const id = Number(params.id)

        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    name: vine.string().trim().minLength(2).optional(),
                    slug: vine
                        .string()
                        .trim()
                        .minLength(3)
                        .alphaNumeric({ allowDashes: true })
                        .optional(),
                })
            )
        )

        const mood = await Mood.query().where('id', id).whereNull('deleted_at').firstOrFail()

        if (payload.slug && payload.slug !== mood.slug) {
            const existingSlug = await Mood.query()
                .where('slug', payload.slug)
                .whereNot('id', id)
                .select('id')
                .first()

            if (existingSlug) {
                throw new Exception(i18n.t('message.mood.slug_taken'), { status: 409 })
            }
        }

        await mood.merge(payload).save()

        return {
            success: true,
            message: i18n.t('message.mood.updated'),
            data: mood.serialize({ fields: ['id', 'name', 'slug'] }),
        }
    }

    async deleteMood({ params, i18n }: HttpContext) {
        const id = Number(params.id)

        const mood = await Mood.query().where('id', id).whereNull('deleted_at').select('id').first()

        if (!mood) {
            throw new Exception(i18n.t('message.mood.not_found'), { status: 404 })
        }

        mood.deletedAt = DateTime.now()
        await mood.save()

        return {
            success: true,
            message: i18n.t('message.mood.deleted'),
            data: {
                id: mood.id,
                name: mood.name,
                slug: mood.slug,
                deletedAt: mood.deletedAt,
            },
        }
    }
}
