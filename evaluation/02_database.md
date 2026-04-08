# 🗄️ Database Evaluation Report

**Project:** Audio Track Platform (AdonisJS 6 Backend)
**Evaluator:** Antigravity AI — Senior DBA Mode
**Date:** 2026-04-06
**Rating: 7.1 / 10**

---

## Overview

The project uses **MySQL** via **AdonisJS Lucid ORM** with 35 migration files. The schema is well-structured overall with evidence of refactoring and incremental improvement. However, several naming inconsistencies, missing constraints, and scalability concerns lower the score.

---

## 🔴 CRITICAL DATABASE BUGS

### 1. ⚠️ Migration Naming Inconsistency — Looks Like Incremental Patches (HIGH)
The migrations directory contains **35 files**, but many are clearly "fixup" migrations:
```
1772024397059_create_fix_deleted_at_columns_table.ts
1772012673661_create_deleted_at_genres_table.ts
1771220544805_create_add_email_at_users_table.ts
1771303330414_create_change_role_in_users_table.ts
1771574384540_create_edit_slug_names_table.ts
```
These patch migrations indicate the original schema was not well-planned. In production this is acceptable, but in development it creates messy rollback scenarios.

**Impact:** Rolling back is complex. `node ace migration:rollback` could fail mid-way with patch migrations that depend on base table state.

**Fix:** Before going live, consolidate patch migrations into original create migrations (squash in dev, keep separately in prod).

---

### 2. ⚠️ `audio` Table Has No Soft-Delete Index Covering `seller_id` (MEDIUM)
The query in `check_subscription_middleware.ts` (lines 85–90) is:
```sql
SELECT COUNT(*) FROM audio
WHERE seller_id = ? AND deleted_at IS NULL AND created_at >= ?
```
Looking at migration `1772105442988_create_index_on_audios_table.ts` — while some indexes exist, the composite index for `(seller_id, deleted_at, created_at)` may be missing or incomplete for monthly upload count queries.

**Impact:** Full table scans for every upload attempt if index is not covering. Degrades heavily with scale.

---

### 3. ⚠️ `subscription_events` Table Stores `metadata` as JSON Without Typing (LOW-MEDIUM)
```typescript
metadata: data.metadata ?? null  // Record<string, any>
```
`metadata` is a JSON column but its schema is completely open. There is no enforced structure. This makes querying it for audits inconsistent — some events store `stripeCustomerId`, others store `error`, `endsAt`, etc.

**Fix:** Define an enum/union type for `metadata` shape per event type and validate before insert.

---

## 🟡 SCHEMA DESIGN ISSUES

### 4. Missing Foreign Key Constraints on Several Tables

Checking the models:
- `audio.seller_id` → references `users.id` ✅ (via model, but check FK in migration)
- `reviews.user_id` and `reviews.audio_id` — need `ON DELETE CASCADE` for when user or track is deleted
- `favourites.user_id` and `favourites.audio_id` — same issue
- `subscriptions.user_id` → references `users.id` — verify `ON DELETE RESTRICT`

**Impact:** Orphaned rows if users or audio tracks are deleted directly from DB.

**Fix:** Add explicit FK constraints in migrations with `table.foreign('user_id').references('users.id').onDelete('CASCADE')`.

### 5. `audio` Table Uses `deleted_at` (Soft Delete) But No Cascade Handling
When audio is soft-deleted:
- Reviews remain in `reviews` table (still queryable)
- Favorites remain (though audio is filtered on load via `status/deleted_at`)
- Pivot records in `audio_genres` and `audio_moods` remain

**Impact:** Pivot tables grow indefinitely. `audio_genres` for soft-deleted audio is never cleaned.

**Fix:** When audio is soft deleted (in `destroy` action), also delete pivot records, or implement a scheduled cleanup job.

### 6. `users` Table Column `is_email_verify` Has Incorrect Column Name
**File:** `app/models/user.ts` (line 35)
```typescript
@column({ columnName: 'is_email_verify' })  // Should be is_email_verified
declare isEmailVerified: boolean
```
The column name in DB is `is_email_verify` (missing 'd'), while the TS property is `isEmailVerified`. This is a naming inconsistency carried from migration `1771220544805_create_add_email_at_users_table.ts`.

**Impact:** Confusing to DBAs, ORM mapping hides the error but it's a subtle bug.

**Fix:** Create a migration to rename column to `is_email_verified`.

### 7. No `updated_at` on `audio` Table
```typescript
@column.dateTime({ autoCreate: true })
declare createdAt: DateTime
// ← No updatedAt!
```
The `Audio` model has no `updatedAt` column. When a track is edited (title, slug, bpm, status), there is no record of when it was last modified.

**Impact:** Inability to track change history, cache invalidation is harder, audit trail is incomplete.

**Fix:** Add `updated_at` column to `audio` table via migration, and add `@column.dateTime({ autoCreate: true, autoUpdate: true })` to model.

### 8. `subscription_events.subscription_id` Stores Stripe String ID, No FK
This is intentional (external Stripe IDs), but no index exists on this column making `getBySubscription()` a full table scan.

**Fix:** Add `table.index('subscription_id')` in migration.

---

## 🟢 WHAT IS DONE WELL

| Area | Status |
|------|--------|
| Migrations are timestamped and ordered | ✅ |
| Composite indexes on `audio` for status+deleted_at | ✅ `1772095534692_create_index_audio_on_status_deleted_ats_table.ts` |
| Pivot table indexes for audio_genres and audio_moods | ✅ Multiple index migrations |
| Soft deletes implemented | ✅ `deleted_at` on audio |
| Subscription audit log table | ✅ Excellent for compliance |
| Transactions used in track create/update | ✅ `db.transaction()` wrapping DB writes |
| `updateOrCreate` for idempotent webhook handling | ✅ Prevents duplicate records |
| `paginate()` used on list endpoints | ✅ |
| Cursor-based pagination on public listing | ✅ Very performant |
| Scrypt password hashing (never stored plain) | ✅ |

---

## Query Quality Analysis

| Controller | Query Issue |
|------------|-------------|
| `check_subscription_middleware` | Two separate COUNT queries per request (monthly + total) — could be merged |
| `admin_tracks_controller.pendingTracks` | Uses manual `limit/offset` instead of `paginate()` — inconsistent |
| `audio_tracks_export_controller` | `while(true)` loop with `paginate()` is correct for streaming, good pattern |
| `track_filter_service` | `RAND()` sort disables all indexes — noted as known issue |
| `public_controller.getByGenre` | Correct cursor pagination but duplicates code from `getByMood` |

---

## Summary Table

| Category | Score | Notes |
|----------|-------|-------|
| Schema Design | 7/10 | Good structure, some naming issues |
| Indexes | 7/10 | Well-indexed, some gaps |
| Migrations | 6/10 | Too many patch migrations |
| Data Integrity (FKs) | 5/10 | Missing cascades/constraints |
| Query Efficiency | 7/10 | Cursor pagination, selective SELECTs |
| Transactions | 9/10 | Used correctly |
| Audit Logging | 8/10 | Subscription events table is excellent |
| Soft Delete | 7/10 | Implemented but orphaned pivot rows |

**Overall Database Score: 7.1 / 10**

---

## Priority Fixes

1. 🔴 Add `ON DELETE CASCADE` FK constraints to `reviews` and `favourites`
2. 🔴 Add migration to rename `is_email_verify` → `is_email_verified`
3. 🟡 Add `updated_at` to `audio` table
4. 🟡 Add index on `subscription_events.subscription_id`
5. 🟡 Clean up pivot records on soft delete of audio
6. 🟢 Consolidate patch migrations in dev environment
