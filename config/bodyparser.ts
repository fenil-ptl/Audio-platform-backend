// config/bodyparser.ts
import { defineConfig } from '@adonisjs/core/bodyparser'

export default defineConfig({
    allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

    form: {
        convertEmptyStringsToNull: true,
        types: ['application/x-www-form-urlencoded'],
    },

    multipart: {
        autoProcess: true,
        convertEmptyStringsToNull: true,
        processManually: [],
        limit: '60mb',
        types: ['multipart/form-data'],
    },

    json: {
        encoding: 'utf-8',
        limit: '1mb',
        strict: true,
        types: [
            'application/json',
            'application/json-patch+json',
            'application/vnd.api+json',
            'application/csp-report',
        ],
    } as any,
})
