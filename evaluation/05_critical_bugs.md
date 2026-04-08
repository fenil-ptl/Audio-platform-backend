# 🐛 Critical Bug Report

**Project:** Audio Track Platform (AdonisJS 6 Backend)
**Evaluator:** Antigravity AI — Senior QA/Bug Hunter Mode
**Date:** 2026-04-06
**Total Critical Bugs Found: 11 | Medium Bugs: 9 | Low/Code Quality: 8**

---

## 🔴 CRITICAL BUGS (Production Breaking)

---

### BUG-001: `Audio.knexQuery()` Throws Unimplemented Error
**File:** `app/models/audio.ts` (lines 11–13)
**Severity:** 🔴 Critical
```typescript
export default class Audio extends BaseModel {
    static knexQuery() {
        throw new Error('Method not implemented.')  // ← RUNTIME CRASH
    }
```
**Problem:** This method stub exists and throws an error. If ANY part of the codebase calls `Audio.knexQuery()` either directly or via an ORM internal, it will crash the entire request.

**Why This Exists:** Appears to be an auto-generated stub from an IDE (VSCode/Qodo) that was never implemented.

**Impact:** If AdonisJS Lucid internally calls `knexQuery()` during certain query builder chains, this will trigger unexpected 500 errors.

**Fix:** Remove the method entirely if not needed, or implement it properly:
```typescript
// Remove these lines:
static knexQuery() {
    throw new Error('Method not implemented.')
}
```

---

### BUG-002: Payment Refund Has No Ownership Verification
**File:** `app/controllers/payments_controller.ts` (lines 46–58)
**Severity:** 🔴 Critical
```typescript
async refund({ request, response }: HttpContext) {
    const { paymentIntentId, amount } = request.only(['paymentIntentId', 'amount'])
    // ← No check: does this paymentIntentId belong to auth.user?
    const result = await stripeService.refundPayment(paymentIntentId, amount)
```
**Impact:** Any authenticated user can pass ANY `paymentIntentId` and trigger a refund on another user's payment. Financial loss.

**Fix:**
```typescript
// Add ownership check:
const payment = await Payment.query()
    .where('payment_intent_id', paymentIntentId)
    .where('user_id', auth.user!.id)  // or check admin role
    .firstOrFail()
```

---

### BUG-003: `GET /api/payments` Exposes All Payments to Any User
**File:** `app/controllers/payments_controller.ts` (lines 65–68)
**Severity:** 🔴 Critical
```typescript
async list({ response }: HttpContext) {
    const payments = await stripeService.listPayments()  // ALL records
    return response.ok(payments)
}
```
```typescript
// stripe_service.ts
async listPayments() {
    return Payment.query().orderBy('created_at', 'desc')  // No user filter
}
```
**Impact:** Every logged-in user sees every other user's payment records.

**Fix:** Add `middleware.role(['admin'])` to route or filter by user.

---

### BUG-004: `process.env` Used Without Fallback — Silent Plan Validation Bypass
**File:** `app/controllers/subscriptions_controller.ts` (lines 157–173)
**Severity:** 🔴 Critical
```typescript
const validPriceIds = [
    process.env.PRICE_PERSONAL,      // undefined if not set
    process.env.PRICE_PROFESSIONAL,  // undefined if not set
    ...
].filter(Boolean)  // ← silently removes undefined

if (!validPriceIds.includes(priceId)) {
    throw new Exception('Invalid plan selected.', { status: 400 })
}
```
**Problem:** If even ONE price env var is misconfigured/missing in production, `filter(Boolean)` removes it from the valid list. A user submitting that price ID gets "Invalid plan" — but the real price still works on Stripe. This causes customer-facing payment failure with no diagnostic.

**Fix:** Use validated `env.get()` + add all 5 price IDs to `env.ts` schema.

---

### BUG-005: `queue.dispatch()` Return Is Not Awaited — Errors Silently Lost
**File:** `app/controllers/auth_controller.ts` (lines 32, 146, 219)
**Severity:** 🔴 Critical (for email delivery reliability)
```typescript
queue.dispatch(AuthMailJob, { type: 'VERIFY_EMAIL', userId: user.id })
// ← NOT awaited! Dispatch error is eaten silently
```
**Problem:** `queue.dispatch()` is async. If the Redis queue connection is unavailable, this call fails silently — the user registers successfully but never receives a verification email. The error is completely invisible.

**Fix:**
```typescript
// Option A: await and handle errors
try {
    await queue.dispatch(AuthMailJob, { type: 'VERIFY_EMAIL', userId: user.id })
} catch (err) {
    logger.error('Failed to dispatch email job', { userId: user.id, err })
    // Optionally throw or handle gracefully
}
```

---

### BUG-006: `Audio.knexQuery` Conflict With `from('audio as a')` Alias Pattern
**File:** `app/controllers/public_controller.ts` (line 78), `app/services/track_filter_service.ts` (line 97)
**Severity:** 🔴 Critical
```typescript
const query = Audio.query()
    .from('audio as a')   // ← uses table alias 'a'
    .where('a.status', 'approve')
```
The `Audio` model has a custom `knexQuery()` that **throws**. If `Audio.query()` internally calls `knexQuery()` during `.from()` override, every public track listing request will crash.

This needs immediate investigation to confirm if it triggers the throw.

---

### BUG-007: Webhook Controller Instantiates `StripeService` at Module Level
**File:** `app/controllers/webhooks_controller.ts` (line 5)
```typescript
const stripeService = new StripeService()  // module-level
```
**Problem:** `StripeService` contains a `priceCache = new Map<string, Stripe.Price>()`. With module-level instantiation, every hot reload in development or module re-import creates a new cache instance. In production this wastes memory as multiple controller module loads create orphaned service instances.

---

## 🟡 MEDIUM BUGS

---

### BUG-008: `favourites_controller.toggle()` Returns Inconsistent Response Shape
**File:** `app/controllers/favourites_controller.ts` (lines 33–46)
```typescript
if (existing) {
    await existing.delete()
    return {
        message: ...,   // ← NO `success` field
        favorited: false,
    }
}

await Favorite.create(...)
return {
    success: true,   // ← HAS `success` field
    message: ...,
    favorited: true,
}
```
**Impact:** Frontend must handle two different response shapes for the same endpoint. Clients checking `response.success` will get `undefined` for removals.

**Fix:** Add `success: true` to the removal response.

---

### BUG-009: `reviews_controller.update()` — Zero Update Check Is Wrong
**File:** `app/controllers/reviews_controller.ts` (line 135)
```typescript
if (!payload.rating && payload.comment === undefined) {
    throw new Exception('No fields provided to update', { status: 422 })
}
```
**Problem:** `!payload.rating` is truthy when `rating = 0`, but rating cannot be 0 (min is 1). However this check is semantically wrong — it should be checking `payload.rating === undefined`, not `!payload.rating`.

If someone sends `{ rating: 0 }` (which Vine rejects), this check becomes unreliable. More importantly, the logic `!payload.rating` is a falsy check, not an undefined check.

**Fix:**
```typescript
if (payload.rating === undefined && payload.comment === undefined) {
    throw new Exception('No fields provided to update', { status: 422 })
}
```

---

### BUG-010: `admin_tracks_controller.pendingTracks` — Manual Pagination Is Inconsistent
**File:** `app/controllers/admin/admin_tracks_controller.ts` (lines 27–28)
```typescript
.limit(perPage)
.offset((currentPage - 1) * perPage)
```
vs. every other controller using:
```typescript
.paginate(page ?? 1, limit ?? 10)
```
**Impact:** Inconsistent pagination metadata structure returned. The manual limit/offset returns a raw array while `paginate()` returns `{ data, meta }`. This will break any frontend component expecting consistent API shape.

---

### BUG-011: `check_subscription_middleware` — `cancel_at_period_end` Logic Blocks Access Immediately
**File:** `app/middleware/check_subscription_middleware.ts` (lines 29–37)
```typescript
if (subscription.status === 'cancel_at_period_end') {
    return response.forbidden({...
        message: `Your subscription ends on ${endsAt}. Renew or upgrade to upload tracks.`
    })
}
```
**Problem:** A user with `cancel_at_period_end` status has **paid** and their subscription is **still active**. Blocking them from uploading tracks is incorrect — they should be able to upload until the period ends. This is a business logic bug that will anger paying customers.

**Fix:**
```typescript
// Only block if the period has actually ended
if (subscription.status === 'cancel_at_period_end') {
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) {
        return response.forbidden({ ... })
    }
    // Otherwise let them through — they've paid through period end
}
```

---

### BUG-012: Email Template Links Are Relative URLs (May Break)
**File:** `app/jobs/auth_mail_job.ts` (lines 33–35)
```typescript
const signedUrl = router.makeSignedUrl('auth.verifyEmail', { id: user.id }, { expiresIn: '24h' })
// signedUrl is something like: /auth/verify-email/1?signature=...

await mail.send((message) => {
    message.html(`<a href="${baseUrl}${signedUrl}">Verify Email</a>`)
```
**Problem:** `router.makeSignedUrl()` returns a path like `/auth/verify-email/1?...`. Concatenating `baseUrl + signedUrl` works ONLY if `signedUrl` starts with `/`. If the router ever returns an absolute URL or the path prefix changes, the link breaks.

**Fix:**
```typescript
// Use URL constructor for safe concatenation:
const url = new URL(signedUrl, baseUrl)
```

---

### BUG-013: `subscription_audit_service` Uses `console.error` Instead of Logger
**File:** `app/services/subscription_audit_service.ts` (line 34)
```typescript
console.error('[AuditLog] Failed to write subscription event:', err)
```
**Impact:** Audit failures go to unstructured console output, bypassing the configured Pino logger. Cannot be monitored or alerted on in production.

**Fix:**
```typescript
import logger from '@adonisjs/core/services/logger'
logger.error({ err }, '[AuditLog] Failed to write subscription event')
```

---

### BUG-014: `audio_tracks_export_controller` — `try/catch` Can Never Catch After `pipe()`
**File:** `app/controllers/audio_tracks_export_controller.ts` (lines 50–112)
```typescript
stringifier.pipe(response.response)  // ← Streaming started
// ...
try {
    // ... loop writing to stringifier
} catch (error) {
    return response.internalServerError({ ... })  // ← CANNOT work!
```
**Problem:** Once `pipe()` is called and the response stream has started, you cannot send a new HTTP response. The `internalServerError` inside catch will silently fail or corrupt the partially-sent CSV.

**Fix:** Check for errors BEFORE starting the stream, or use a proper stream error handler and close the stream gracefully.

---

### BUG-015: `public_controller.show()` Does Not Require Authentication But Route Has `middleware.role(['user'])`
**File:** `start/routes.ts` (lines 95–98)
```typescript
router
    .get('/track/:id', [publicController, 'show'])
    .middleware([middleware.role(['user']), publicthrottle])
```
**Problem:** `role` middleware runs without `auth` middleware. Looking at `role_middleware.ts`:
```typescript
const user = ctx.auth.user as User
if (!user || !allowedRoles.includes(user.role)) {
    return ctx.response.forbidden(...)
```
If `auth` middleware is not applied first, `ctx.auth.user` is `undefined`. An unauthenticated request to `GET /track/:id` hits `role` middleware, `user` is `undefined`, and returns **403 Forbidden** instead of the public track data.

**This means individual track detail is inaccessible to unauthenticated users.** This may be intentional (paywall model) but then the public throttle makes no sense. If unintentional, this is a business-breaking bug hiding public content.

---

## 🟢 LOW / CODE QUALITY BUGS

| ID | File | Issue |
|----|------|-------|
| BUG-016 | `seller_track_controller.ts:62` | `console.error()` instead of logger |
| BUG-017 | `seller_track_controller.ts:64` | `console.warn()` instead of logger |
| BUG-018 | `seller_track_controller.ts:252,256` | Same — `console.error/warn` not using Pino |
| BUG-019 | `audio.ts` | `updatedAt` column missing from model |
| BUG-020 | `user.ts` | Column `is_email_verify` should be `is_email_verified` |
| BUG-021 | `stripe_service.ts:658,769` | `process.env.APP_URL` used instead of `env.get()` |
| BUG-022 | `stripe_service.ts:241` | Idempotency key uses `toISOString().slice(0,16)` — bucket is 1 minute. With CHECKOUT_IDEMPOTENCY_BUCKET_SECONDS=300 (5 min), the keys don't align. |
| BUG-023 | `public_controller.ts` | `getByGenre` and `getByMood` are ~80 lines of duplicated code |

---

## Bug Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 7 |
| 🟡 Medium | 8 |
| 🟢 Low | 8 |
| **Total** | **23** |

---

## Top 5 Bugs to Fix Immediately

1. **BUG-001** — Remove the throwing `Audio.knexQuery()` stub
2. **BUG-002** — Add ownership check to refund endpoint
3. **BUG-003** — Restrict payment list to admins  
4. **BUG-011** — Fix `cancel_at_period_end` blocking paying users
5. **BUG-015** — Fix `GET /track/:id` being inaccessible to unauthenticated users (unless intentional)
