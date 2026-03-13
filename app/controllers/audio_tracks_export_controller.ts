import type { HttpContext } from '@adonisjs/core/http'
import Audio from '#models/audio'
import { stringify } from 'csv-stringify'
import Logger from '@adonisjs/core/services/logger'

export default class AdminAudioController {
    async export({ request, response, auth }: HttpContext) {
        const admin = auth.getUserOrFail()
        const format = request.input('format', 'csv')

        if (format !== 'csv') {
            return response.badRequest({
                message: 'Only CSV format is supported',
            })
        }

        Logger.info('CSV export started', {
            adminId: admin.id,
            adminEmail: admin.email,
            timestamp: new Date().toISOString(),
        })

        try {
            response.header('Content-Type', 'text/csv; charset=utf-8')
            response.header('Content-Disposition', 'attachment; filename="audio-tracks-export.csv"')

            const stringifier = stringify({
                header: true,
                quoted: true,
                quoted_empty: true,
                escape: '"',
                columns: [
                    { key: 'id', header: 'ID' },
                    { key: 'sellerId', header: 'Seller ID' },
                    { key: 'title', header: 'Title' },
                    { key: 'slug', header: 'Slug' },
                    { key: 'fileUrl', header: 'File URL' },
                    { key: 'imageUrl', header: 'Image URL' },
                    { key: 'bpm', header: 'BPM' },
                    { key: 'duration', header: 'Duration' },
                    { key: 'status', header: 'Status' },
                    { key: 'rejectReason', header: 'Reject Reason' },
                    { key: 'reviewedBy', header: 'Reviewed By' },
                    { key: 'createdAt', header: 'Created At' },
                    { key: 'reviewedAt', header: 'Reviewed At' },
                    { key: 'deletedAt', header: 'Deleted At' },
                ],
            })

            stringifier.pipe(response.response)

            stringifier.on('error', (error) => {
                Logger.error('CSV generation error', {
                    adminId: admin.id,
                    error: error.message,
                })
            })

            const chunkSize = 100
            let page = 1
            let totalRecords = 0

            while (true) {
                const audios = await Audio.query().orderBy('id', 'asc').paginate(page, chunkSize)

                const data = audios.all()

                if (data.length === 0) {
                    break
                }

                for (const audio of data) {
                    stringifier.write({
                        id: audio.id,
                        sellerId: audio.sellerId,
                        title: audio.title || '',
                        slug: audio.slug || '',
                        fileUrl: audio.fileUrl || '',
                        imageUrl: audio.imageUrl || '',
                        bpm: audio.bpm || 0,
                        duration: audio.duration || 0,
                        status: audio.status || '',
                        rejectReason: audio.rejectReason || '',
                        reviewedBy: audio.reviewedBy || '',
                        createdAt: audio.createdAt?.toFormat('yyyy-MM-dd HH:mm:ss') || '',
                        reviewedAt: audio.reviewedAt?.toFormat('yyyy-MM-dd HH:mm:ss') || '',
                        deletedAt: audio.deletedAt?.toFormat('yyyy-MM-dd HH:mm:ss') || '',
                    })
                    totalRecords++
                }

                page++
            }

            stringifier.end()

            Logger.info('CSV export completed', {
                adminId: admin.id,
                totalRecords,
                timestamp: new Date().toISOString(),
            })
        } catch (error) {
            Logger.error('CSV export failed', {
                adminId: admin.id,
                error: error.message,
                stack: error.stack,
            })

            return response.internalServerError({
                message: 'Export failed. Please try again later.',
            })
        }
    }
}
