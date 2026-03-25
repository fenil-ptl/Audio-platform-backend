// app/services/audio_duration_service.ts
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobePath from 'ffprobe-static'

// ffmpeg-static  → ffmpeg binary  (encoding/processing)
// ffprobe-static → ffprobe binary (metadata reading) ← was missing
ffmpeg.setFfmpegPath(ffmpegPath as unknown as string)
ffmpeg.setFfprobePath(ffprobePath.path) // ← correct binary now

export default class AudioDurationService {
    static getDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    return reject(err)
                }

                const duration = metadata?.format?.duration

                if (!duration) {
                    return reject(new Error('Unable to extract duration'))
                }

                resolve(Math.floor(duration))
            })
        })
    }
}
