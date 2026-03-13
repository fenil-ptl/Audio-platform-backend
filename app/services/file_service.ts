import { randomUUID } from 'node:crypto'
import { MultipartFile } from '@adonisjs/core/types/bodyparser'
import drive from '@adonisjs/drive/services/main'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import path from 'node:path'
import Logger from '@adonisjs/core/services/logger'
import { FileUploadException, FileMoveException } from '#exceptions/file_exception'

export interface UploadedFileInfo {
    path: string
    size: number
    originalName: string
    mimeType: string
}

export default class FileService {
    async uploadAudio(file: MultipartFile, userId: number): Promise<UploadedFileInfo> {
        const fileName = `${randomUUID()}.${file.extname ?? 'mp3'}`
        const filePath = path.join('audio', String(userId), fileName)
        return this.moveToStorage(file, filePath)
    }

    async uploadImage(file: MultipartFile, userId: number): Promise<UploadedFileInfo> {
        const fileName = `${randomUUID()}.${file.extname ?? 'jpg'}`
        const filePath = path.join('images', String(userId), fileName)
        return this.moveToStorage(file, filePath)
    }

    async delete(filePath: string): Promise<void> {
        try {
            // FIX: deletes from drive, not from tmp
            await drive.use().delete(filePath)
            Logger.info('File deleted from drive', { filePath })
        } catch (error) {
            Logger.warn('Failed to delete file from drive', { filePath, error: error.message })
        }
    }

    // FIX: writes to @adonisjs/drive (persistent S3 / GCS / local disk)
    //      instead of app.tmpPath() which is wiped on restart
    private async moveToStorage(file: MultipartFile, filePath: string): Promise<UploadedFileInfo> {
        const tmpName = `${randomUUID()}_${path.basename(filePath)}`
        const tmpDir = app.tmpPath()

        try {
            // Step 1 — land the multipart upload in tmp first (required by AdonisJS bodyparser)
            await file.move(tmpDir, { name: tmpName, overwrite: false })

            if (!file.isValid) {
                throw new FileMoveException(file.errors[0]?.message ?? 'File move failed')
            }

            // Step 2 — read from tmp and stream into persistent drive storage
            const tmpFullPath = path.join(tmpDir, tmpName)
            const buffer = await fs.readFile(tmpFullPath)
            await drive.use().put(filePath, buffer)

            // Step 3 — clean up tmp now that drive has the file
            await fs.unlink(tmpFullPath).catch(() => {})

            Logger.info('File stored on drive', { filePath, size: file.size })

            return {
                path: filePath,
                size: file.size ?? 0,
                originalName: file.clientName ?? '',
                mimeType: `${file.type}/${file.subtype}`,
            }
        } catch (error) {
            Logger.error('Failed to store file on drive', { filePath, error: error.message })
            throw error instanceof FileUploadException || error instanceof FileMoveException
                ? error
                : new FileUploadException('File upload failed')
        }
    }
}
