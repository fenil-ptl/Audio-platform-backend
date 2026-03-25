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

        const genre = await Genre.create({
            name: payload.name,
            slug: payload.slug,
        })

        return {
            success: true,
            message: i18n.t('message.genre.created'),
            data: genre.serialize({ fields: ['id', 'name', 'slug'] }),
        }
    }

    async editGenres({ request, params, i18n }: HttpContext) {
        const id = Number(params.id)

        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    name: vine.string().trim().minLength(2).optional(),
                    slug: vine
                        .string()
                        .trim()
                        .minLength(3)
                        .alphaNumeric({ allowDashes: true }) // ← Best for slugs
                        .optional(),
                })
            )
        )

        const genre = await Genre.query().where('id', id).whereNull('deleted_at').firstOrFail()

        // Slug uniqueness check (Only if slug is actually changing)
        if (payload.slug && payload.slug !== genre.slug) {
            const slugExists = await Genre.query()
                .where('slug', payload.slug)
                .whereNot('id', id) // ← Important: exclude current genre
                .whereNull('deleted_at')
                .select('id')
                .first()

            if (slugExists) {
                throw new Exception(i18n.t('message.genre.slug_taken'), { status: 409 })
            }
        }

        // Update
        await genre.merge(payload).save()

        return {
            success: true,
            message: i18n.t('message.genre.updated'),
            data: genre.serialize({ fields: ['id', 'name', 'slug'] }), // Recommended
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
            success: true,
            message: i18n.t('message.genre.deleted'),
            data: {
                id: genre.id,
                name: genre.name,
                slug: genre.slug,
                deletedAt: genre.deletedAt,
            },
        }
    }
}
