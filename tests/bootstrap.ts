import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'

export const plugins: Config['plugins'] = [
    assert(),
    pluginAdonisJS(app),
    apiClient(),
    sessionApiClient(app), // ← HERE
    authApiClient(app), // ← HERE
]

export const runnerHooks = {
    setup: [
        async () => {
            await testUtils.db().migrate()
        },
    ],
    teardown: [] as Array<() => Promise<void>>,
}

export const configureSuite: Config['configureSuite'] = (suite) => {
    if (suite.name === 'functional') {
        suite.setup(async () => {
            return testUtils.httpServer().start()
        })
    }
}
