// app/services/file_service.ts
import { randomUUID } from 'node:crypto'
import { MultipartFile } from '@adonisjs/core/types/bodyparser'
import { Exception } from '@adonisjs/core/exceptions'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import path from 'node:path'
import Logger from '@adonisjs/core/services/logger'

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
            const absolutePath = app.tmpPath(filePath)
            await fs.unlink(absolutePath)
            Logger.info('File deleted', { filePath })
        } catch (error) {
            Logger.warn('Failed to delete file', { filePath, error: error.message })
        }
    }

    private async moveToStorage(file: MultipartFile, filePath: string): Promise<UploadedFileInfo> {
        try {
            const absoluteDir = app.tmpPath(path.dirname(filePath))
            await fs.mkdir(absoluteDir, { recursive: true })

            await file.move(absoluteDir, { name: path.basename(filePath), overwrite: false })

            if (!file.isValid) {
                throw new Exception(file.errors[0]?.message ?? 'File move failed', {
                    status: 500,
                    code: 'E_FILE_MOVE_FAILED',
                })
            }

            Logger.info('File stored', { filePath, size: file.size })

            return {
                path: filePath,
                size: file.size ?? 0,
                originalName: file.clientName ?? '',
                mimeType: `${file.type}/${file.subtype}`,
            }
        } catch (error) {
            Logger.error('Failed to store file', { filePath, error: error.message })
            throw error instanceof Exception
                ? error
                : new Exception('File upload failed', { status: 500, code: 'E_FILE_UPLOAD_FAILED' })
        }
    }
}
