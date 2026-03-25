import { randomUUID } from 'node:crypto'
import { MultipartFile } from '@adonisjs/core/types/bodyparser'
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
    // ── Step 1: Move MultipartFile to tmp for ffprobe ───────────────────
    // Returns absolute tmp path. MultipartFile.move() called ONCE here.
    async moveAudioToTmp(file: MultipartFile): Promise<string> {
        const tmpDir = app.tmpPath('audio_uploads')
        await fs.mkdir(tmpDir, { recursive: true })

        const fileName = `${randomUUID()}.${file.extname ?? 'mp3'}`
        await file.move(tmpDir, { name: fileName, overwrite: false })

        if (!file.isValid) {
            throw new FileMoveException(file.errors[0]?.message ?? 'File move failed')
        }

        return path.join(tmpDir, fileName)
    }

    // ── Step 2: Move from tmp to final storage after ffprobe ────────────
    // Uses fs.rename — no MultipartFile involved, no second move() call
    async uploadAudioFromTmp(
        tmpFilePath: string,
        userId: number,
        meta: { size: number; originalName: string; mimeType: string }
    ): Promise<UploadedFileInfo> {
        const ext = path.extname(tmpFilePath) || '.mp3'
        const fileName = `${randomUUID()}${ext}`
        const destRelPath = path.join('audio', String(userId), fileName)
        const destAbsDir = app.tmpPath(path.join('audio', String(userId)))
        const destAbsPath = path.join(destAbsDir, fileName)

        await fs.mkdir(destAbsDir, { recursive: true })

        // fs.rename is instant on same filesystem, falls back to copy+delete
        await fs.rename(tmpFilePath, destAbsPath).catch(async () => {
            await fs.copyFile(tmpFilePath, destAbsPath)
            await fs.unlink(tmpFilePath).catch(() => {})
        })

        Logger.info('Audio moved to storage', { path: destRelPath })

        return {
            path: destRelPath,
            size: meta.size,
            originalName: meta.originalName,
            mimeType: meta.mimeType,
        }
    }

    // ── Image upload ────────────────────────────────────────────────────
    async uploadImage(file: MultipartFile, userId: number): Promise<UploadedFileInfo> {
        const fileName = `${randomUUID()}.${file.extname ?? 'jpg'}`
        const filePath = path.join('images', String(userId), fileName)
        return this.moveToStorage(file, filePath)
    }

    // ── Delete a stored file ────────────────────────────────────────────
    async delete(filePath: string): Promise<void> {
        try {
            const absolutePath = app.tmpPath(filePath)
            await fs.unlink(absolutePath)
            Logger.info('File deleted', { filePath })
        } catch (error) {
            Logger.warn('Failed to delete file', { filePath, error: error.message })
        }
    }

    // ── Internal: move MultipartFile to a storage path ──────────────────
    private async moveToStorage(file: MultipartFile, filePath: string): Promise<UploadedFileInfo> {
        try {
            const absoluteDir = app.tmpPath(path.dirname(filePath))
            await fs.mkdir(absoluteDir, { recursive: true })

            await file.move(absoluteDir, { name: path.basename(filePath), overwrite: false })

            if (!file.isValid) {
                throw new FileMoveException(file.errors[0]?.message ?? 'File move failed')
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
            throw error instanceof FileUploadException || error instanceof FileMoveException
                ? error
                : new FileUploadException('File upload failed')
        }
    }
}
