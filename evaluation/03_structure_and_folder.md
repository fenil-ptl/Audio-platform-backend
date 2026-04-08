# 📁 Structure & Folder Organization Evaluation Report

**Project:** Audio Track Platform (AdonisJS 6 Backend)
**Evaluator:** Antigravity AI — Senior Architect Mode
**Date:** 2026-04-06
**Rating: 7.8 / 10**

---

## Project Layout Overview

```
audio-track-project/
├── app/
│   ├── controllers/
│   │   ├── admin/                    ← ✅ Properly nested admin controllers
│   │   │   ├── admin_genres_controller.ts
│   │   │   ├── admin_moods_controller.ts
│   │   │   └── admin_tracks_controller.ts
│   │   ├── auth_controller.ts
│   │   ├── audio_tracks_export_controller.ts
│   │   ├── favourites_controller.ts
│   │   ├── payments_controller.ts
│   │   ├── public_controller.ts
│   │   ├── reviews_controller.ts
│   │   ├── seller_track_controller.ts
│   │   ├── subscriptions_controller.ts
│   │   └── webhooks_controller.ts
│   ├── dtos/
│   │   └── track_filter_dto.ts       ← ✅ DTO layer added
│   ├── exceptions/                   ← ✅ Custom exception classes
│   ├── jobs/
│   │   └── auth_mail_job.ts          ← only 1 job file
│   ├── middleware/
│   │   ├── auth_middleware.ts
│   │   ├── check_subscription_middleware.ts
│   │   ├── container_bindings_middleware.ts
│   │   ├── detect_user_locale_middleware.ts
│   │   ├── force_json_response_middleware.ts
│   │   ├── role_middleware.ts
│   │   └── verify_email_middleware.ts
│   ├── models/
│   │   ├── audio.ts, customer.ts, favourite.ts, genre.ts
│   │   ├── mood.ts, payment.ts, review.ts, subscription.ts
│   │   ├── subscription_event.ts, user.ts, password_reset_token.ts
│   │   └── email_verification_token.ts
│   └── services/
│       ├── audio_duration_service.ts
│       ├── file_service.ts
│       ├── stripe_service.ts          ← ⚠️ 855 lines — God Service
│       ├── subscription_audit_service.ts
│       └── track_filter_service.ts
├── config/                           ← ✅ All config centralized
├── database/
│   ├── migrations/                   ← 35 migration files
│   └── seeders/
├── start/
│   ├── env.ts, kernel.ts, limiter.ts, routes.ts
├── tests/
└── resources/
```

---

## 🔴 CRITICAL STRUCTURE ISSUES

### 1. ⚠️ `stripe_service.ts` Is a 855-Line "God Service" (HIGH)
**File:** `app/services/stripe_service.ts`

This single file handles:
- Payment intents
- Checkout sessions
- Customer management
- Subscription creation/cancellation/upgrade
- Webhook event processing (12+ event types)
- Billing portal sessions
- Idempotency key management
- Price caching

**Impact:** Extremely hard to test, maintain, or extend. Adding a new payment feature means touching an 855-line file. A bug in one area affects others. Violates Single Responsibility Principle (SRP) severely.

**Fix:** Split into:
```
app/services/stripe/
├── stripe_customer_service.ts         (createCustomer, findCustomer)
├── stripe_payment_service.ts          (createIntent, refund, status)
├── stripe_checkout_service.ts         (createCheckoutSession, findReusableSession)
├── stripe_subscription_service.ts     (create, cancel, upgrade, get)
├── stripe_webhook_service.ts          (constructEvent, handleWebhookEvent)
└── stripe_base_service.ts             (shared: priceCache, mapStatus, resolvePeriodEnd)
```

---

### 2. ⚠️ `public_controller.ts` Has Duplicated `getByGenre` / `getByMood` Logic (MEDIUM)
Both methods (lines 129–210 and 212–287) are nearly identical — cursor pagination, limit parsing, and query structure are copy-pasted with only the join table changed.

**Impact:** Any bug fix in genre pagination must be manually applied to mood pagination. DRY violation.

**Fix:** Extract a shared private `fetchByCategoryId(joinTable, columnId, params)` method.

---

## 🟡 MEDIUM STRUCTURE ISSUES

### 3. Validators Are Inline in Controllers (Not in Separate Files)
All validation schemas are defined **inside controller methods** using `vine.compile()`. AdonisJS recommends a separate `app/validators/` folder.

```typescript
// Current — bad for reuse and testing
const payload = await request.validateUsing(
    vine.compile(vine.object({ ... }))  // inline, re-compiled each request
)
```

**Impact:**
- Schemas are re-compiled on every request (minor performance cost)
- Cannot reuse validators between controllers
- Cannot unit test validators in isolation

**Fix:** Create `app/validators/` folder:
```
app/validators/
├── auth_validator.ts
├── track_validator.ts
├── subscription_validator.ts
└── review_validator.ts
```

### 4. `StripeService` Instantiated as Module-Level Singleton (MEDIUM)
**Files:** `payments_controller.ts` (line 5), `subscriptions_controller.ts` (line 9), `webhooks_controller.ts` (line 5)
```typescript
const stripeService = new StripeService()  // module-level instance
```
This is not using AdonisJS's IoC container. `@inject()` is used for `FileService` correctly, but `StripeService` bypasses dependency injection entirely.

**Impact:** Cannot mock in tests, multiple instances created across imports, breaks AdonisJS lifecycle management.

**Fix:** Register `StripeService` in IoC container and use `@inject()` decorator.

### 5. `audio_tracks_export_controller.ts` — Wrong Class Name
```typescript
export default class AdminAudioController  // ← Wrong name
```
The file is `audio_tracks_export_controller.ts` but the class is `AdminAudioController`. Naming inconsistency breaks `grep`-based navigation.

**Fix:** Rename class to `AudioTracksExportController`.

### 6. `role_middleware.ts` Has Commented-Out Code Block
```typescript
/*


*/
```
Lines 26–30 contain an empty comment block. Dead code/stubs in the codebase.

### 7. Missing `app/validators/` and `app/mails/` Directories Referenced in `package.json`
`package.json` imports map includes:
```json
"#mails/*": "./app/mails/*.js",
"#validators/*": "./app/validators/*.js",
```
But neither folder exists. This won't crash (TypeScript path aliases are permissive) but indicates structural intent that was never completed.

---

## 🟢 WHAT IS DONE WELL

| Area | Status |
|------|--------|
| AdonisJS conventions followed | ✅ Proper directory structure |
| Admin routes nested in `admin/` subfolder | ✅ |
| Services folder clearly separated | ✅ |
| DTOs folder for data transfer objects | ✅ |
| Middleware naming is descriptive | ✅ |
| Jobs folder for queue workers | ✅ |
| Config folder properly centralized | ✅ |
| `start/` folder for kernel, routes, limiters | ✅ Idiomatic AdonisJS |
| Lazy-loaded controllers in routes | ✅ `() => import(...)` pattern |
| `@inject()` used for FileService | ✅ IoC container used correctly |
| TypeScript path aliases configured | ✅ `#controllers/*`, `#models/*` etc. |

---

## File Size Analysis

| File | Lines | Problem |
|------|-------|---------|
| `stripe_service.ts` | 855 | 🔴 God Service — split immediately |
| `subscriptions_controller.ts` | 549 | 🟡 Large but manageable |
| `seller_track_controller.ts` | 363 | 🟢 Acceptable |
| `public_controller.ts` | 289 | 🟡 DRY violation |
| `payments_controller.ts` | 179 | 🟢 Good |
| `auth_controller.ts` | 228 | 🟢 Good |

---

## Summary Table

| Category | Score | Notes |
|----------|-------|-------|
| Directory Structure | 9/10 | Follows AdonisJS conventions well |
| File Naming | 7/10 | One class name mismatch |
| Controller Design | 8/10 | Clean and focused mostly |
| Service Layer | 5/10 | God service kills this score |
| Separation of Concerns | 7/10 | Good but validators inline |
| Code Reuse (DRY) | 6/10 | getByGenre/getByMood duplication |
| IoC Container Usage | 6/10 | StripeService bypasses DI |

**Overall Structure Score: 7.8 / 10**

---

## Priority Fixes

1. 🔴 **Split `stripe_service.ts`** into 5–6 focused service files
2. 🔴 **Extract duplicate genre/mood pagination** into shared private method
3. 🟡 **Create `app/validators/`** and move all vine schemas there
4. 🟡 **Register StripeService in IoC** and use `@inject()` 
5. 🟢 **Fix class name** in `audio_tracks_export_controller.ts`
6. 🟢 **Remove dead comment block** in `role_middleware.ts`
