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
            throw new Exception(i18n.t('messages.mood.slug_taken'), { status: 409 })
        }

        await Mood.create({
            name: payload.name,
            slug: payload.slug,
        })

        return {
            message: i18n.t('messages.mood.created'),
        }
    }

    async editMood({ request, params, i18n }: HttpContext) {
        const id = Number(params.id)

        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    name: vine.string().trim().optional(),
                    slug: vine.string().trim().optional(),
                })
            )
        )

        const mood = await Mood.query()
            .where('id', id)
            .whereNull('deleted_at')
            .select('id', 'name', 'slug')
            .first()

        if (!mood) {
            throw new Exception(i18n.t('messages.mood.not_found'), { status: 404 })
        }

        await mood.merge(payload).save()

        return {
            message: i18n.t('messages.mood.updated'),
        }
    }

    async deleteMood({ params, i18n }: HttpContext) {
        const id = Number(params.id)

        const mood = await Mood.query().where('id', id).whereNull('deleted_at').select('id').first()

        if (!mood) {
            throw new Exception(i18n.t('messages.mood.not_found'), { status: 404 })
        }

        mood.deletedAt = DateTime.now()
        await mood.save()

        return {
            message: i18n.t('messages.mood.deleted'),
        }
    }
}
