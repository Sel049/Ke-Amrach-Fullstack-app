# Ke-Amrach — Analytics & Settings: Implementation Plan & Progress

> Single source of truth for the work to make client/admin analytics & settings
> fully real (replace mock data with API + DB). Another developer/AI model
> should read this and continue exactly where the last person stopped.

## 1. Project context

- **Stack:** React (Vite) in `client/`; Node + Express + MySQL (mysql2) in `server/`. Server is ES modules (`"type": "module"`).
- **Auth:** Firebase Auth (`firebase_uid` on `users`) + an app JWT. Guards live in `server/src/middleware/auth.js`.
- **DB:** Live MySQL already has real data — 8 users (1 admin, 2 farmers, 5 buyers), 8 produce listings, 16 orders (7 completed = ETB 5,490), 90 notifications, 4 reviews.
- **Convention:** migration scripts in `server/scripts/` use `import { pool } from '../src/config/database.js'` → `await pool.query(...)` → `await pool.end()` (see `add-password-reset-table.js`). Canonical SQL is `server/src/sql/schema.sql` (applied by `apply-schema-and-admin.js`). The API also `CREATE TABLE IF NOT EXISTS` a subset of tables on boot in `server/src/index.js`.

> 💰 **Free-tier budget:** user is on free services. No paid features. Payment provider will be **Chapa demo/sandbox** (see Phase 4) — do NOT build payment processing yet.

## 2. Phases & status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | DB foundation: `system_settings`, `activity_logs` + seed defaults | ✅ DONE |
| 1 | Admin Analytics real from `/dashboard/admin/analytics` | ✅ DONE |
| 2 | Admin Settings real via new `/api/settings` + enforcement + frontend gates | ✅ DONE |
| 3 | Buyer/Farmer market trends real (fix `price_trends.woreda`) | TODO |
| 4 | Payment (Chapa demo) + fix IDOR on payment routes | TODO — discuss first |
| 5 | Order stats, security section, market-trends dashboard, browse fallback | TODO |

Focus: **Phases 0+1+2 (admin side real first)**, then client-side phases after.

## 3. Phase 0 — DB foundation (DONE)

Created:
- `system_settings(id, category, setting_key unique per category, setting_value JSON, updated_by, created_at, updated_at)`. Values are typed JSON (bool/number/string) so reads preserve types.
- `activity_logs(id, user_id, actor_name, actor_role, action, entity_type, entity_id, message, meta JSON, created_at)`. Generic audit trail.

DDL lives in 3 places: `server/scripts/apply-admin-settings-schema.js`, appended to `server/src/sql/schema.sql`, and the boot block in `server/src/index.js`. Run: `cd server && npm run db:admin-settings`.

Seeded defaults (categories = general, notifications, security, payment, features):
- general: siteName "Ethio Farmers Shop", siteDescription "...", defaultLanguage "en", timezone "Africa/Addis_Ababa", currency "ETB", maintenanceMode `false`
- notifications: email `true`, sms `false`, push `true`, orderAlerts/userRegistrationAlerts/systemAlerts `true`
- security: twoFactorAuth `true`, passwordMinLength `8`, sessionTimeout `30`, maxLoginAttempts `5`, ipWhitelist `false`, auditLogging `true`
- payment: stripeEnabled `true`, paypalEnabled `false`, bankTransferEnabled `true`, mobileMoneyEnabled `true`, commissionRate `5`, minimumPayout `1000` (placeholders → revised for Chapa in Phase 4)
- features: userRegistration `true`, farmerVerification `true`, listingApproval `true`, orderTracking `true`, reviewsEnabled `true`, chatEnabled `true`

## 4. Phase 1 — Admin Analytics (IN PROGRESS)

**Backend** (`server/src/controllers/dashboardController.js`): rewrite `getAdminAnalytics` (kept behind `verifyRole('admin')`), add a `buildDateRange(period)` helper (periods `7d|30d|90d|1y`, plus previous range and bucket/label generator for zero-filled charts). Response shape consumed by the page:

```js
{
  period,
  revenue:  { total, growth, chart: [{ label, value }] },
  users:    { total, growth, chart: [{ label, value }] },
  orders:   { total, growth, chart: [{ label, value }] },
  listings: { total, growth, chart: [{ label, value }] },
  topCategories: [{ name, value(%), revenue, color }], // top 5 by completed-order revenue
  topFarmers:    [{ name, orders, revenue, rating }],   // reuse existing query
  recentActivity:[{ type, message, time(relative), value }]
}
```
KPI `total`s are lifetime (revenue = SUM completed orders; users/orders = COUNT; listings = active). `growth` = current vs previous window.

**Frontend** (`client/src/pages/admin-analytics/index.jsx`): remove all mocks; call `dashboardService.getAdminAnalytics(period)`; add loading/error states; guard chart `Math.max` for empty/all-zero series; wire Export Report to build a CSV from the response and download it.

## 5. Phase 2 — Admin Settings (IN PROGRESS)

**Backend:** `server/src/controllers/settingsController.js` (`getSettings`, `updateSettings`, `getPublicSettings`), an in-memory `settingsService` cache + `getSettingValue()`, routes `server/src/routes/settingsRoutes.js` mounted at `/api/settings` (public: `GET /api/settings/public`). `updateSettings` validates groups (general/notifications/security/payment/features), writes JSON rows, logs to `activity_logs`. Settings are ENFORCED:
- `general.maintenanceMode` → middleware in `index.js` returns 503 (except `/health`).
- `features.userRegistration` → gate in `authController.register`.
- `features.reviewsEnabled` → gate in review creation.
- `security.sessionTimeout` / `maxLoginAttempts` → read via `getSettingValue()`.

**Frontend** (`client/src/pages/admin-settings/index.jsx`): replace fake `setTimeout` save/reset/backup with real API calls (new `settingsService` in `client/src/services/apiService.js` or dedicated module); real save/error states + last-saved time.

## 6. Conventions & gotchas

1. Money is `NUMERIC(12,2)`, currency ETB. Don't invent currencies.
2. Orders enum = `pending,confirmed,shipped,completed,cancelled` (NO `delivered`). Use `completed` for revenue/farmers.
3. `price_trends` has NO `woreda` column but `marketTrendsController` filters on it → breaks `?woreda=`. Fix in Phase 3.
4. IDOR: payment routes accept `:userId` without comparing to `req.user`; `payment_*` tables don't exist. Fix in Phase 4.
5. Admin analytics route requires `verifyRole('admin')`.
6. Add a `db:<name>` npm script for every migration.

## 7. Progress log

- [x] Phase 0: tables created & seeded; DDL mirrored in `schema.sql` + `index.js` boot block.
- [x] Phase 1 backend: real admin analytics controller (`getAdminAnalytics` in `dashboardController.js`).
- [x] Phase 1 frontend: admin-analytics wired to API (`dashboardService.getAdminAnalytics`).
- [x] Phase 2 backend: settings controller/routes + enforcement.
- [x] Phase 2 frontend: admin-settings wired to API + public-settings provider + feature gates.
- [ ] Phase 3: market trends (fix `price_trends.woreda`), buyer/farmer pages.
- [ ] Phase 4: Chapa demo payment — **discuss with user first**.
- [ ] Phase 5: order stats, security section, market-trends dashboard, browse fallback.

## 8. Handoff footsteps (for the next model / developer)

If you are picking this up cold, the pieces below are already in place and working.
**Do not recreate them** — read them and build on top.

### Backend (Phase 0–2 done)
- `server/scripts/apply-admin-settings-schema.js` — migration. Run via `cd server && npm run db:admin-settings` (script exists in `server/package.json`).
- `server/src/services/settingsService.js` — in-memory settings cache (10s TTL). Exports `loadSettings(force)`, `getSettingValue(category, key, fallback)`, `clearSettingsCache()`. `getSettingValue` lazily loads on first call, so no explicit boot call is needed (though it's fine to warm it).
- `server/src/controllers/settingsController.js` — `getSettings` (admin), `getPublicSettings`, `updateSettings` (admin, validates groups, writes JSON, logs to `activity_logs`, refreshes cache).
- `server/src/routes/settingsRoutes.js` — mounted in `server/src/routes/index.js` at `/settings`. Endpoints:
  - `GET /api/settings/public` — NO auth. Returns `{ maintenanceMode, features }` only.
  - `GET /api/settings` — `verifyToken` + `verifyRole('admin')`.
  - `PUT /api/settings` — admin only.
- `server/src/middleware/auth.js` — exports `verifyToken`, `verifyRole(...roles)` (role guard used for admin routes).
- **Enforcement points (settings actually change behavior — all live-verified):**
  - `general.maintenanceMode` → middleware in `server/src/index.js` returns 503 for non-admins. Admins (dev-token) bypass via a DB role lookup. `/health`, `/api/settings/*`, `/uploads` bypass always.
  - `features.userRegistration` → checked at the very TOP of `authController.registerUser` (BEFORE field validation) → 403 when off.
  - `features.reviewsEnabled` → checked at top of `reviewController.createReview` → 403 when off.
  - `security.sessionTimeout` / `security.maxLoginAttempts` → readable via `getSettingValue('security', 'sessionTimeout', 30)` etc. (wire into auth as needed).

### Frontend (Phase 0–2 done)
- `client/src/services/apiService.js` — added `settingsService` (`getPublicSettings`, `getSettings`, `updateSettings`).
- `client/src/hooks/usePublicSettings.jsx` — `PublicSettingsProvider` + `usePublicSettings()` hook. Exposes `isMaintenanceMode`, `isRegistrationEnabled`, `isReviewsEnabled`, `isChatEnabled`, `isOrderTrackingEnabled`, `refresh()`. **Provider is wired in `client/src/App.jsx`** (innermost, inside `CartProvider`).
- `client/src/components/MaintenanceGate.jsx` — full-screen maintenance page for non-admins when `maintenanceMode` on; admins bypass.
- `client/src/components/ui/AuthenticatedLayout.jsx` — wraps content in `<MaintenanceGate>` and shows an amber "Maintenance Mode is ON" banner to admins.
- `client/src/pages/admin-settings/index.jsx` — real `loadSettings()` (GET) + `handleSaveSettings()` (PUT) with success/error banner; Reset re-fetches.
- `client/src/pages/authentication-login-register/components/RegisterForm.jsx` — shows an amber notice + disables submit when `isRegistrationEnabled === false`.
- `client/src/components/ReviewForm.jsx` — renders a disabled notice instead of the form when `isReviewsEnabled === false`.

### How to verify it still works
```bash
# 1. apply/seed the settings tables (idempotent)
cd server && npm run db:admin-settings

# 2. syntax-check the server
cd server && node --check src/index.js && node --check src/controllers/settingsController.js

# 3. start server + client, log in as admin, open /admin-settings,
#    toggle "Maintenance Mode", Save → non-admin visitors get the maintenance page.
```

### What's next (start here)
- **Phase 3** — market trends. Known bug: `price_trends` has no `woreda` column but `marketTrendsController` filters on it. Fix the query (or add the column) and wire buyer/farmer market-trend pages to real data.
- **Phase 4** — payments. **STOP and talk to the user first.** Plan is Chapa demo/sandbox only (free tier). Also fix IDOR: payment routes accept `:userId` without checking `req.user`, and `payment_*` tables don't exist yet.

### Verification status of this session
- All edited server files pass `node --check`.
- All edited client `.jsx/.js` files pass `esbuild` transform (syntax) check.
- **Live end-to-end verified** (server started, real DB):
  - `GET /health` → 200
  - `GET /api/settings/public` → returns `maintenanceMode` + `features` (no auth)
  - `GET /api/settings` (admin dev-token) → 200, full settings
  - `PUT /api/settings` (admin) → 200, writes persist + activity log
  - Maintenance ON: non-admin → **503**; admin → **200** (bypass); public + health → **200**
  - Reviews OFF → `POST /api/reviews` → **403** "Reviews are currently disabled"
  - Registration OFF → `POST /api/auth/register` → **403** "Registration is currently disabled" (gate runs before field validation)
  - All settings restored to seeded defaults at end of session.