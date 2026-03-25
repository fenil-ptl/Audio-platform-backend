import Review from '#models/review'
import Audio from '#models/audio'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

export default class ReviewsController {
    // POST /track/:audioId/reviews
    async store({ params, request, auth, i18n }: HttpContext) {
        const user = auth.user!
        const audioId = Number(params.audioId)

        if (Number.isNaN(audioId)) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const track = await Audio.query()
            .where('id', audioId)
            .where('status', 'approve')
            .whereNull('deleted_at')
            .select('id')
            .first()

        if (!track) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const alreadyReviewed = await Review.query()
            .where('user_id', user.id)
            .where('audio_id', audioId)
            .first()

        if (alreadyReviewed) {
            throw new Exception(i18n.t('message.review.already_reviewed'), { status: 409 })
        }

        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    rating: vine.number().min(1).max(5).withoutDecimals(),
                    comment: vine.string().trim().minLength(10).maxLength(1000).optional(),
                })
            )
        )

        const review = await Review.create({
            userId: user.id,
            audioId,
            rating: payload.rating,
            comment: payload.comment ?? null,
        })

        // Load user relation for response
        await review.load('user', (q) => q.select('id', 'fullName'))

        return {
            success: true,
            message: i18n.t('message.review.created'),
            data: review.serialize(),
        }
    }

    // GET /track/:audioId/reviews  — public, no auth required
    async index({ params, request, i18n }: HttpContext) {
        const audioId = Number(params.audioId)
        const { page, limit } = await request.validateUsing(
            vine.compile(
                vine.object({
                    page: vine.number().positive().min(1).max(1000).optional(),
                    limit: vine.number().positive().min(1).max(100).optional(),
                })
            )
        )

        if (Number.isNaN(audioId)) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const track = await Audio.query()
            .where('id', audioId)
            .where('status', 'approve')
            .whereNull('deleted_at')
            .select('id')
            .first()

        if (!track) {
            throw new Exception(i18n.t('message.track.not_found'), { status: 404 })
        }

        const [reviews, stats] = await Promise.all([
            Review.query()
                .where('audio_id', audioId)
                .preload('user', (q) => q.select('id', 'fullName'))
                .select('id', 'user_id', 'rating', 'comment', 'created_at', 'updated_at')
                .orderBy('created_at', 'desc')
                .paginate(page ?? 1, limit ?? 10),

            Review.query()
                .where('audio_id', audioId)
                .avg('rating as avgRating')
                .count('* as total')
                .first(),
        ])

        return {
            message: i18n.t('message.review.fetched'),
            meta: {
                avgRating: Number(stats?.$extras.avgRating ?? 0).toFixed(1),
                totalReviews: Number(stats?.$extras.total ?? 0),
            },
            data: reviews.toJSON(),
        }
    }

    // PATCH /reviews/:id  — update own review
    async update({ params, request, auth, i18n }: HttpContext) {
        const user = auth.user!
        const reviewId = Number(params.id)

        const review = await Review.query().where('id', reviewId).where('user_id', user.id).first()

        if (!review) {
            throw new Exception(i18n.t('message.review.not_found'), { status: 404 })
        }

        const payload = await request.validateUsing(
            vine.compile(
                vine.object({
                    rating: vine.number().min(1).max(5).withoutDecimals().optional(),
                    comment: vine.string().trim().minLength(10).maxLength(1000).optional(),
                })
            )
        )

        if (!payload.rating && payload.comment === undefined) {
            throw new Exception('No fields provided to update', { status: 422 })
        }

        await review.merge(payload).save()

        return {
            success: true,
            message: i18n.t('message.review.updated'),
            data: review.serialize(),
        }
    }

    // DELETE /reviews/:id  — delete own review
    async destroy({ params, auth, i18n }: HttpContext) {
        const user = auth.user!
        const reviewId = Number(params.id)

        const review = await Review.query().where('id', reviewId).where('user_id', user.id).first()

        if (!review) {
            throw new Exception(i18n.t('message.review.not_found'), { status: 404 })
        }

        await review.delete()

        return {
            success: true,
            message: i18n.t('message.review.deleted'),
            data: null,
        }
    }
}
