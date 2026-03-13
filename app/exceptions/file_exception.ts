import { Exception } from '@adonisjs/core/exceptions'

export class InvalidFileTypeException extends Exception {
    static status = 400
    static code = 'E_INVALID_FILE_TYPE'

    constructor(message: string = 'Invalid file type') {
        super(message)
    }
}

export class InvalidFileContentException extends Exception {
    static status = 400
    static code = 'E_INVALID_FILE_CONTENT'

    constructor(message: string = 'Invalid file content') {
        super(message)
    }
}

export class FileUploadException extends Exception {
    static status = 500
    static code = 'E_FILE_UPLOAD_FAILED'

    constructor(message: string = 'File upload failed') {
        super(message)
    }
}
