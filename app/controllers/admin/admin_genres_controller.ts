import Genre from '#models/genre'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export default class AdminGenresController {
    async createGenres({ request, i18n }: HttpContext) {
        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    name: vine.enum([
                        'pop',
                        'rock',
                        'folk',
                        'electronic',
                        'jazz',
                        'lofi',
                        'ambient',
                        'house',
                        'hip-hop',
                        'classical',
                    ] as const),
                    slug: vine.string().minLength(5),
                })
            )
        )

        const existingSlug = await Genre.query().where('slug', payload.slug).select('id').first()

        if (existingSlug) {
            throw new Exception(i18n.t('message.genre.slug_taken'), { status: 409 })
        }

        await Genre.create({
            name: payload.name,
            slug: payload.slug,
        })

        return {
            message: i18n.t('message.genre.created'),
        }
    }

    async editGenres({ request, params, i18n }: HttpContext) {
        const id = Number(params.id)

        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    name: vine.string().trim().optional(),
                    slug: vine.string().optional(),
                })
            )
        )

        const genre = await Genre.query()
            .where('id', id)
            .whereNull('deleted_at')
            .select('id', 'name', 'slug')
            .first()

        if (!genre) {
            throw new Exception(i18n.t('message.genre.not_found'), { status: 404 })
        }

        if (payload.slug && payload.slug !== genre.slug) {
            const slugExists = await Genre.query()
                .where('slug', payload.slug)
                .whereNull('deleted_at')
                .select('id')
                .first()

            if (slugExists) {
                throw new Exception(i18n.t('message.genre.slug_taken'), { status: 409 })
            }
        }

        await genre.merge(payload).save()

        return {
            message: i18n.t('message.genre.updated'),
        }
    }

    async deleteGenre({ params, i18n }: HttpContext) {
        const id = Number(params.id)

        const genre = await Genre.query()
            .where('id', id)
            .whereNull('deleted_at')
            .select('id')
            .first()

        if (!genre) {
            throw new Exception(i18n.t('message.genre.not_found'), { status: 404 })
        }

        genre.deletedAt = DateTime.now()
        await genre.save()

        return {
            message: i18n.t('message.genre.deleted'),
        }
    }
}
