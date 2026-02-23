import type { HttpContext } from '@adonisjs/core/http'
import Audio from '#models/audio'

export default class AdminAudioController {
  async export({ request, response }: HttpContext) {
    const format = request.input('format')
    if (format !== 'csv') {
      return response.badRequest({
        message: 'Only csv format supported',
      })
    }

    response.header('Content-Type', 'text/csv')
    response.header('Content-Disposition', 'attachment; filename="audio-report.csv"')

    // CSV Header
    response.response.write(
      'ID,SellerID,Title,Slug,File Url,Image Url,Bpm,Duration,Status,Reject Reason,Reviewed By,Created At, Reviewed At, Deleted At\n'
    )

    const chunkSize = 100

    let page = 1
    let hasMore = true

    while (hasMore) {
      const audios = await Audio.query().orderBy('id').forPage(page, chunkSize)

      if (audios.length === 0) {
        hasMore = false
        break
      }

      for (const audio of audios) {
        const line = `${audio.id},${audio.sellerId},${audio.title},${audio.slug},${audio.fileUrl},${audio.imageUrl},${audio.bpm},${audio.duration},${audio.status},${audio.rejectReason},${audio.reviewedBy},${audio.createdAt},${audio.reviewedAt},${audio.deletedAt},\n`
        response.response.write(line)
      }

      page++
    }

    response.response.end()
  }
}
