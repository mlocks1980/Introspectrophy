# Migration Report: Fulcrum Guide -> Introspectropy SR-OS

## Files Modified

- `server.js`
- `public/app.js`
- `public/styles.css`
- `package.json`
- `.gitignore`
- `README.md`
- `docs/README.md`
- `migrations/001_introspectropy_sros.sql`
- `scripts/smoke-test.mjs`
- Phase 2 UX additions in `public/app.js` and `public/styles.css`

## Files Created

- `migrations/001_introspectropy_sros.sql`
- `docs/README.md`
- `src/components/ReflectionInput.tsx`
- `src/components/PatternDrawer.tsx`
- `src/components/FulcrumLaboratory.tsx`
- `src/components/FuturePatternAlert.tsx`
- `src/components/Dashboard.tsx`
- `src/components/IdentityBaselineProtocol.tsx`
- `MIGRATION_REPORT.md`
- `scripts/smoke-test.mjs`
- `scripts/migrate-postgres.mjs`

## Files Deprecated

- Legacy calibration question workflow in `public/app.js`
- Legacy reading score API: `POST /api/readings`, `GET /api/readings`
- Legacy journal API: `POST /api/journals`
- Legacy library/protocol completion flow as primary architecture
- Legacy Fulcrum Guide dashboard metrics based on readings and journals

## Database Migrations

Production PostgreSQL migration added:

```text
migrations/001_introspectropy_sros.sql
```

Tables:

- `users`
- `user_sessions`
- `reflections`
- `behavioral_signals`
- `active_patterns`
- `pattern_links`
- `assumption_profiles`
- `micro_experiments`
- `future_alerts`
- `interception_logs`
- `analytics_events`

PostgreSQL runtime is enabled by `DATABASE_URL`.

Run:

```bash
npm install
npm run db:migrate
```

Local JSON fallback migrates legacy `journals` into `reflections` once via `_journalsMigrated`.

Local generated JSON files under `data/` are ignored by Git.

## Required Environment Variables

```bash
DATABASE_URL=postgres://user:password@host:5432/database
APP_ORIGIN=https://your-domain.example
PORT=3000
```

Supabase usage requires the database connection string, not the publishable browser key:

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Optional:

```bash
DATABASE_SSL=false
DATA_FILE=./data/db.json
```

## Breaking Changes

- The app no longer centers on calibration readings.
- Dashboard metrics now report Pattern Interception Rate and Pattern First state.
- Legacy journal entries are treated as reflections.
- Pattern activation requires 3 related behavioral signals inside 90 days.

## API Summary

- `POST /api/reflections`
- `GET /api/patterns`
- `POST /api/patterns/:id/experiment`
- `GET /api/alerts`
- `POST /api/interceptions`
- `GET /api/dashboard`
- `POST /api/analytics`
- `GET /api/analytics-dashboard`

Authentication routes are preserved:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

## Component Summary

The static runtime is still served from `public/app.js`. Requested component boundaries were added under `src/components` for implementation handoff:

- `ReflectionInput.tsx`
- `PatternDrawer.tsx`
- `FulcrumLaboratory.tsx`
- `FuturePatternAlert.tsx`
- `Dashboard.tsx`
- `IdentityBaselineProtocol.tsx`

Phase 2 runtime sections added in `public/app.js`:

- Guided onboarding tour
- Reflection guidance and starter prompts
- Tigris guide companion
- Why Introspectropy
- Pricing
- Enterprise
- Analytics dashboard

## Known Limitations

- ICE is deterministic keyword/weight based for MVP validation.
- PostgreSQL persistence is wired through `DATABASE_URL`.
- Component `.tsx` files are handoff boundaries; the current app runtime is dependency-free vanilla JS.
- PostgreSQL adapter uses whole-state synchronization to preserve existing API route behavior; targeted SQL writes should replace this before high-volume use.
- `pg` must be installed with `npm install` before using PostgreSQL.
- Legacy calibration/readings routes were removed from the active API surface.
- Product analytics are event-count based and intended for MVP directional signals.

## Verification

Passed:

```powershell
& "C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --check server.js
& "C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --check public\app.js
& "C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --check scripts\smoke-test.mjs
& "C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\smoke-test.mjs
```

PostgreSQL validation command after migrations:

```bash
DATABASE_URL=postgres://user:password@host:5432/database npm run test:smoke
```

## Next Test Command

```powershell
& "C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\smoke-test.mjs
```
