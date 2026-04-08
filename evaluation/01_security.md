# 🔒 Security Evaluation Report

**Project:** Audio Track Platform (AdonisJS 6 Backend)
**Evaluator:** Antigravity AI — Senior Security Auditor Mode
**Date:** 2026-04-06
**Rating: 6.2 / 10**

---

## 🔴 CRITICAL BUGS / VULNERABILITIES

### 1. ⚠️ LIVE SECRETS COMMITTED IN `.env` (CRITICAL)
**File:** `.env`
```
STRIPE_SECRET_KEY=sk_test_51TErKzDvxzsNrmIM...  ← REAL Stripe secret key in repo
STRIPE_WEBHOOK_SECRET=whsec_2197314...           ← REAL webhook secret
DB_PASSWORD=admin@1234                           ← Database password
SMTP_PASSWORD=DmRsaEmCuEkFKESM7J               ← Mail server password
APP_KEY=EkmC3LnmbNXEl-q965ad6wSyeR7rl6qZ        ← AdonisJS app key
```
**Impact:** Anyone with access to this repository can drain your Stripe account, access the database, or send emails using your SMTP account. `.env` is in `.gitignore` but the file EXISTS on disk and has been observed. If this was ever pushed to git history, the keys must be **rotated immediately**.

**Fix:** Rotate ALL credentials. Never commit `.env` to version control. Use `.env.example` for documentation only.

---

### 2. ⚠️ `process.env` Used Directly Instead of Validated `env` Service (HIGH)
**Files:** `subscriptions_controller.ts` (lines 158–163, 422–426), `payments_controller.ts` (lines 85–91), `stripe_service.ts` (line 17)

```typescript
// BAD — bypasses AdonisJS env validation
const validPriceIds = [
    process.env.PRICE_PERSONAL,   // Could be undefined silently
    process.env.PRICE_PROFESSIONAL,
    ...
].filter(Boolean)
```

**Impact:** If any env var is missing in production, `filter(Boolean)` silently removes it from the valid list. A user could subscribe to a plan with a stale price ID that is invalid, bypassing your price validation entirely.

**Fix:** Use `env.get('PRICE_PERSONAL')` from the validated `#start/env` service in all files. Add all PRICE_* vars to `env.ts` schema.

---

### 3. ⚠️ CORS `origin` Uses Placeholder Domain in Production (HIGH)
**File:** `config/cors.ts` (lines 8–9)
```typescript
origin: env.get('NODE_ENV') === 'production'
    ? ['https://yourdomain.com', ...]  // ← PLACEHOLDER not set to real domain
```
**Impact:** If deployed without updating this, the CORS policy is misconfigured. Either all requests from legitimate frontends will be blocked, or someone will set `origin: true` to fix it and allow all origins.

**Fix:** Read the allowed origins from an environment variable: `CORS_ORIGIN=https://real.domain.com` and parse/split it.

---

### 4. ⚠️ `refund` Endpoint Has No Authorization Check (HIGH)
**File:** `payments_controller.ts` (lines 46–58)
```typescript
async refund({ request, response }: HttpContext) {
    const { paymentIntentId, amount } = request.only([...])
    // No check: is this user's own payment? Is user an admin?
    const result = await stripeService.refundPayment(paymentIntentId, amount)
```
**Impact:** Any authenticated user can refund ANY payment intent by ID, including other users' payments. This is a serious financial vulnerability.

**Fix:** Verify the `paymentIntentId` belongs to the requesting user (check against the `payments` table), or restrict endpoint to admin role.

---

### 5. ⚠️ `GET /api/payments` Leaks ALL Payment Records to Any Authenticated User (HIGH)
**File:** `payments_controller.ts` (lines 65–68)
```typescript
async list({ response }: HttpContext) {
    const payments = await stripeService.listPayments()  // ALL payments, no user filter
    return response.ok(payments)
```
**Impact:** Exposes every customer's payment records to any logged-in user. Should be admin-only.

**Fix:** Add `middleware.role(['admin'])` to the `/api/payments` list route, or filter by `auth.user!.id`.

---

### 6. ⚠️ Webhook Endpoint Not Protected from Body Parser Re-parsing (MEDIUM)
**File:** `webhooks_controller.ts`

The webhook uses `request.raw()` to get the raw body for Stripe signature verification, which is correct. However, the global `bodyparser_middleware` is in `router.use()` which processes **all** routes. If the body parser consumes the stream before `request.raw()`, signature verification will fail silently.

**Fix:** Configure body parser to disable raw body parsing for `/webhook`, or use AdonisJS's `rawBody: true` setting in bodyparser config for that route.

---

## 🟡 MEDIUM SEVERITY ISSUES

### 7. Rate Limits Are Too Permissive for Public Endpoints
**File:** `start/limiter.ts`
```typescript
export const publicthrottle = limiter.define('public', () => {
    return limiter.allowRequests(5).every('15 minute')
})
```
`GET /track/:id` allows only 5 requests per 15 minutes per IP. This means a real user browsing 6 tracks in 15 minutes gets blocked — but a scraper using many IPs is unaffected. The rate limit granularity (global IP, not per-user) makes it more punishing for legitimate users.

**Fix:** For authenticated routes, rate limit by `user.id`. For public routes, increase to 30–60 rps with a tighter per-second burst.

### 8. Session Middleware Applied But Not Used (Low Risk)
**File:** `start/kernel.ts` (line 39)
The app uses **database access tokens** for authentication but also loads `session_middleware`. Sessions are unused but add overhead and a potential attack surface.

**Fix:** Remove session middleware if not needed.

### 9. Email Enumeration Possible on `resendVerification` (LOW)
**File:** `auth_controller.ts` (lines 197–226)
The response is the same whether the user exists or not — good. However, the response time differs (DB query happens only if user doesn't exist as verified). Timing attacks could theoretically enumerate emails.

### 10. No HTTPS Enforcement / HSTS Headers
No security headers middleware (Helmet equivalent) is configured. Missing:
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Content-Security-Policy`

---

## 🟢 WHAT IS DONE WELL

| Area | Status |
|------|--------|
| Password hashing | ✅ scrypt via AdonisJS `hash` |
| Password regex rules | ✅ Uppercase, lowercase, number, special char required |
| Signed URLs for email verification | ✅ Correctly used with expiry |
| Token-based auth with expiry (`1d`) | ✅ |
| Role-based access control middleware | ✅ `role(['admin'])`, `role(['seller'])` |
| Email verification middleware on sensitive routes | ✅ |
| Stripe webhook signature verification | ✅ `constructWebhookEvent` used |
| Input validation (Vine) on all endpoints | ✅ |
| SQL injection prevention | ✅ ORM + `whereRaw` with parameterized queries |
| Token cleanup on password reset | ✅ All existing tokens deleted |
| Forgot password timing-safe (no user leak) | ✅ Always returns 200 |

---

## Summary Table

| Category | Score | Notes |
|----------|-------|-------|
| Input Validation | 9/10 | Vine used consistently |
| Authentication | 8/10 | Solid token auth, signed URLs |
| Authorization | 5/10 | Payment list/refund missing role guards |
| Secret Management | 2/10 | Live credentials in `.env` file |
| Rate Limiting | 6/10 | Exists but misconfigured for UX |
| CORS | 5/10 | Placeholder domain in production config |
| Security Headers | 2/10 | None configured |
| Webhook Security | 7/10 | Signature check present, body parsing concern |

**Overall Security Score: 6.2 / 10**

---

## Immediate Action Items (Priority Order)

1. 🚨 **Rotate all credentials** (Stripe key, DB password, SMTP, APP_KEY)
2. 🚨 **Add admin role guard** to `/api/payments` and `/api/payments/refund`
3. 🔴 **Replace `process.env` with validated `env.get()`** in subscription/payment controllers
4. 🔴 **Fix CORS production origins** — read from environment variable
5. 🟡 **Add security headers** (use a middleware like `@adonisjs/shield` or manual headers)
6. 🟡 **Move stripe price IDs** into `env.ts` schema with proper validation
