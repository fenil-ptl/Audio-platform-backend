import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import router from '@adonisjs/core/services/router'

// ─────────────────────────────────────────────────────
// TRUNCATE HELPER — disables FK checks before wiping
// ─────────────────────────────────────────────────────
async function truncate() {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.rawQuery('TRUNCATE TABLE auth_access_tokens')
    await db.rawQuery('TRUNCATE TABLE password_reset_tokens')
    await db.rawQuery('TRUNCATE TABLE users')
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
}

// ─────────────────────────────────────────────────────
// HELPER — create user with unique email per test
// ─────────────────────────────────────────────────────
async function createUser(
    overrides: Partial<{
        fullName: string
        email: string
        password: string
        isEmailVerified: boolean
        role: 'seller' | 'user' | 'admin'
    }> = {}
) {
    return User.create({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'Secret@123',
        isEmailVerified: true,
        role: 'user',
        ...overrides,
    })
}

// ═══════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════

test.group('Auth | Register', (group) => {
    group.each.setup(() => truncate())

    test('should return 422 when required fields are missing', async ({ client }) => {
        const response = await client.post('/auth/register').json({})
        response.assertStatus(422)
        response.assertBodyContains({
            errors: [
                { field: 'fullName', rule: 'required' },
                { field: 'email', rule: 'required' },
                { field: 'password', rule: 'required' },
                { field: 'role', rule: 'required' },
            ],
        })
    })

    test('should return 422 when fullName is too short', async ({ client }) => {
        const response = await client.post('/auth/register').json({
            fullName: 'Jo',
            email: 'john@example.com',
            password: 'Secret@123',
            role: 'user',
        })
        response.assertStatus(422)
    })

    test('should return 422 when email is invalid', async ({ client }) => {
        const response = await client.post('/auth/register').json({
            fullName: 'John Doe',
            email: 'not-an-email',
            password: 'Secret@123',
            role: 'user',
        })
        response.assertStatus(422)
    })

    test('should return 422 when password is weak', async ({ client }) => {
        const response = await client.post('/auth/register').json({
            fullName: 'John Doe',
            email: 'john@example.com',
            password: 'weakpass',
            role: 'user',
        })
        response.assertStatus(422)
    })

    test('should return 422 when role is invalid', async ({ client }) => {
        const response = await client.post('/auth/register').json({
            fullName: 'John Doe',
            email: 'john@example.com',
            password: 'Secret@123',
            role: 'superuser',
        })
        response.assertStatus(422)
    })

    test('should return 409 when email already exists', async ({ client }) => {
        await createUser()

        const response = await client.post('/auth/register').json({
            fullName: 'Another John',
            email: 'john@example.com',
            password: 'Secret@123',
            role: 'user',
        })
        response.assertStatus(409)
    })

    test('should register successfully', async ({ client, assert }) => {
        const response = await client.post('/auth/register').json({
            fullName: 'John Doe',
            email: 'newuser@example.com', // ← unique email
            password: 'Secret@123',
            role: 'user',
        })

        response.assertStatus(200)

        const user = await User.findBy('email', 'newuser@example.com')
        assert.isNotNull(user)
        assert.equal(user!.fullName, 'John Doe')
        assert.equal(Number(user!.isEmailVerified), 0)
        assert.notEqual(user!.password, 'Secret@123')
    })
})

// ═══════════════════════════════════════════════════════
// VERIFY EMAIL
// ═══════════════════════════════════════════════════════

test.group('Auth | Verify Email', (group) => {
    group.each.setup(() => truncate())

    test('should return 400 when signature is invalid', async ({ client }) => {
        const response = await client.get('/auth/verify-email/1?signature=invalidsignature')
        response.assertStatus(400)
    })

    test('should return 400 when user is already verified', async ({ client }) => {
        const user = await createUser({
            email: 'verified@example.com',
            isEmailVerified: true,
        })

        const signedUrl = router.makeSignedUrl(
            'auth.verifyEmail',
            { id: user.id },
            { expiresIn: '24h' }
        )

        const response = await client.get(signedUrl)
        response.assertStatus(400)
    })

    test('should verify email successfully', async ({ client, assert }) => {
        const user = await createUser({
            email: 'unverified@example.com',
            isEmailVerified: false,
        })

        const signedUrl = router.makeSignedUrl(
            'auth.verifyEmail',
            { id: user.id },
            { expiresIn: '24h' }
        )

        const response = await client.get(signedUrl)
        response.assertStatus(200)

        await user.refresh()
        assert.equal(Number(user.isEmailVerified), 1)
    })
})

// ═══════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════

test.group('Auth | Login', (group) => {
    group.each.setup(() => truncate())

    test('should return 422 when email and password are missing', async ({ client }) => {
        const response = await client.post('/auth/login').json({})
        response.assertStatus(422)
        response.assertBodyContains({
            errors: [
                { field: 'email', rule: 'required' },
                { field: 'password', rule: 'required' },
            ],
        })
    })

    test('should return 401 when user does not exist', async ({ client }) => {
        const response = await client.post('/auth/login').json({
            email: 'nobody@example.com',
            password: 'Secret@123',
        })
        response.assertStatus(401)
    })

    test('should return 400 when password is incorrect', async ({ client }) => {
        await createUser({ email: 'login1@example.com' })

        const response = await client.post('/auth/login').json({
            email: 'login1@example.com',
            password: 'WrongPassword@123',
        })
        response.assertStatus(400)
    })

    test('should return 403 when email is not verified', async ({ client }) => {
        await createUser({
            email: 'unverified@example.com',
            isEmailVerified: false,
        })

        const response = await client.post('/auth/login').json({
            email: 'unverified@example.com',
            password: 'Secret@123',
        })
        response.assertStatus(403)
    })

    test('should login successfully and return token', async ({ client, assert }) => {
        await createUser({ email: 'login2@example.com' })

        const response = await client.post('/auth/login').json({
            email: 'login2@example.com',
            password: 'Secret@123',
        })

        response.assertStatus(200)

        const body = response.body()
        assert.exists(body.token)
    })
})

// ═══════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════

test.group('Auth | Logout', (group) => {
    group.each.setup(() => truncate())

    test('should return 401 when not authenticated', async ({ client }) => {
        const response = await client.post('/auth/logout')
        response.assertStatus(401)
    })

    test('should logout successfully', async ({ client }) => {
        const user = await createUser({ email: 'logout1@example.com' })

        const response = await client.post('/auth/logout').loginAs(user)

        response.assertStatus(200)
    })

    test('should invalidate token after logout', async ({ client }) => {
        await createUser({ email: 'logout2@example.com' })

        const loginResponse = await client.post('/auth/login').json({
            email: 'logout2@example.com',
            password: 'Secret@123',
        })

        const token = loginResponse.body().token

        await client.post('/auth/logout').header('Authorization', `Bearer ${token}`)

        // ✅ Use a protected route to verify token is dead
        // Change this path if your route is different
        const response = await client
            .post('/auth/logout')
            .header('Authorization', `Bearer ${token}`)

        response.assertStatus(401)
    })

    test('should only invalidate current token not all tokens', async ({ client }) => {
        await createUser({ email: 'logout3@example.com' })

        const login1 = await client.post('/auth/login').json({
            email: 'logout3@example.com',
            password: 'Secret@123',
        })

        const login2 = await client.post('/auth/login').json({
            email: 'logout3@example.com',
            password: 'Secret@123',
        })

        // Logout first token only
        await client.post('/auth/logout').header('Authorization', `Bearer ${login1.body().token}`)

        // First token should be dead
        const response1 = await client
            .post('/auth/logout')
            .header('Authorization', `Bearer ${login1.body().token}`)
        response1.assertStatus(401)

        // Second token should still work — logout returns 200
        const response2 = await client
            .post('/auth/logout')
            .header('Authorization', `Bearer ${login2.body().token}`)
        response2.assertStatus(200)
    })
})

// ═══════════════════════════════════════════════════════
// ME
// ═══════════════════════════════════════════════════════

test.group('Auth | me', (group) => {
    group.each.setup(() => truncate())

    test('should return 401 when not authenticated', async ({ client }) => {
        // ⚠️ Change '/auth/me' to your actual route
        // Check start/routes.ts for the correct path
        const response = await client.get('/auth/me')
        response.assertStatus(401)
    })

    test('should return authenticated user data', async ({ client }) => {
        const user = await createUser({ email: 'me1@example.com' })

        const response = await client
            .get('/auth/me') // ⚠️ Change to your actual route
            .loginAs(user)

        response.assertStatus(200)
        response.assertBodyContains({
            user: { email: 'me1@example.com' },
        })
    })

    test('should not return password in response', async ({ client, assert }) => {
        const user = await createUser({ email: 'me2@example.com' })

        const response = await client
            .get('/auth/me') // ⚠️ Change to your actual route
            .loginAs(user)

        response.assertStatus(200)

        const body = response.body()
        assert.notExists(body.user.password)
    })
})

// ═══════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════

test.group('Auth | Forgot Password', (group) => {
    group.each.setup(() => truncate())

    test('should return 422 when email is missing', async ({ client }) => {
        const response = await client.post('/auth/forgot-password').json({})
        response.assertStatus(422)
        response.assertBodyContains({
            errors: [{ field: 'email', rule: 'required' }],
        })
    })

    test('should return 422 when email format is invalid', async ({ client }) => {
        const response = await client.post('/auth/forgot-password').json({
            email: 'not-an-email',
        })
        response.assertStatus(422)
    })

    test('should return 200 when email does not exist', async ({ client }) => {
        const response = await client.post('/auth/forgot-password').json({
            email: 'nobody@example.com',
        })
        response.assertStatus(200)
    })

    test('should return 200 when email exists', async ({ client }) => {
        await createUser({ email: 'forgot1@example.com' })

        const response = await client.post('/auth/forgot-password').json({
            email: 'forgot1@example.com',
        })
        response.assertStatus(200)
    })
})

// ═══════════════════════════════════════════════════════
// RESEND VERIFICATION
// ═══════════════════════════════════════════════════════

test.group('Auth | Resend Verification', (group) => {
    group.each.setup(() => truncate())

    test('should return 422 when email is missing', async ({ client }) => {
        const response = await client.post('/auth/resend-verification').json({})
        response.assertStatus(422)
        response.assertBodyContains({
            errors: [{ field: 'email', rule: 'required' }],
        })
    })

    test('should return 200 when email does not exist', async ({ client }) => {
        const response = await client.post('/auth/resend-verification').json({
            email: 'nobody@example.com',
        })
        response.assertStatus(200)
    })

    test('should return 200 when email is already verified', async ({ client }) => {
        await createUser({
            email: 'resend1@example.com',
            isEmailVerified: true,
        })

        const response = await client.post('/auth/resend-verification').json({
            email: 'resend1@example.com',
        })
        response.assertStatus(200)
    })

    test('should resend for unverified user successfully', async ({ client }) => {
        await createUser({
            email: 'resend2@example.com',
            isEmailVerified: false,
        })

        const response = await client.post('/auth/resend-verification').json({
            email: 'resend2@example.com',
        })
        response.assertStatus(200)
    })
})

// ═══════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════

test.group('Auth | Reset Password', (group) => {
    group.each.setup(() => truncate())

    test('should return 400 when signature is invalid', async ({ client }) => {
        const response = await client
            .post('/auth/reset-password/1')
            .qs({ signature: 'invalidsig' })
            .json({ password: 'NewSecret@123' })

        response.assertStatus(400)
    })

    test('should return 400 when token not found in DB', async ({ client }) => {
        const user = await createUser({ email: 'reset1@example.com' })

        const signedUrl = router.makeSignedUrl(
            'auth.resetPassword',
            { id: user.id },
            { expiresIn: '15m' }
        )

        const response = await client
            .post(signedUrl)
            .qs({ token: 'nonexistenttoken' })
            .json({ password: 'NewSecret@123' })

        response.assertStatus(400)
    })

    test('should reset password successfully', async ({ client, assert }) => {
        const user = await createUser({ email: 'reset2@example.com' })

        const signedUrl = router.makeSignedUrl(
            'auth.resetPassword',
            { id: user.id },
            { expiresIn: '15m' }
        )

        const response = await client.post(signedUrl).json({ password: 'NewSecret@123' }) // ❌ REMOVE token

        response.assertStatus(200)

        await user.refresh()
        assert.notEqual(user.password, 'Secret@123')
    })

    test('should return 400 when reusing same reset link', async ({ client }) => {
        const { default: PasswordResetToken } = await import('#models/password_reset_token')
        const { default: string } = await import('@adonisjs/core/helpers/string')
        const { DateTime } = await import('luxon')

        const user = await createUser({ email: 'reset3@example.com' })
        const rawToken = string.generateRandom(64)

        await PasswordResetToken.create({
            userId: user.id,
            token: rawToken,
            expiresAt: DateTime.now().plus({ minutes: 15 }),
        })

        const signedUrl = router.makeSignedUrl(
            'auth.resetPassword',
            { id: user.id },
            { expiresIn: '15m' }
        )

        // First use — success
        await client.post(signedUrl).qs({ token: rawToken }).json({ password: 'NewSecret@123' })

        // Second use — token deleted — should fail
        const response = await client
            .post(signedUrl)
            .qs({ token: rawToken })
            .json({ password: 'AnotherSecret@123' })

        response.assertStatus(400)
    })
})
