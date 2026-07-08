# Introspectropy SR-OS

Self Reflection Operating System MVP using the Pattern First architecture.

The app includes:

- Static frontend served from `public/`
- Existing Node authentication/session infrastructure
- Introspectropy Classification Engine service
- Pattern Drawer
- Fulcrum Laboratory
- Future Pattern Alert
- Pattern Interception Rate dashboard
- Guided onboarding tour and Tigris guide companion
- Why Introspectropy, Pricing, Enterprise, and Analytics sections
- PostgreSQL persistence through `DATABASE_URL`
- Local JSON fallback for development only

## Run Locally

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

If Node is not on PATH in Codex Desktop, use:

```powershell
& "C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

Or double-click:

```text
start-app.bat
```

## Environment

```bash
PORT=3000
APP_ORIGIN=https://your-domain.example
DATABASE_URL=postgres://user:password@host:5432/database
```

Optional local fallback:

```bash
DATA_FILE=./data/db.json
DATABASE_SSL=false
```

## Supabase

Use Supabase as the PostgreSQL host by setting `DATABASE_URL` to the database connection string from Supabase Project Settings.

Do not use `NEXT_PUBLIC_SUPABASE_URL` or the Supabase publishable browser key for this backend persistence layer. Those values are for client-side Supabase SDK usage in frameworks like Next.js. This app writes through server-side PostgreSQL using `DATABASE_URL`.

Expected Supabase format:

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

For hosted Supabase, leave `DATABASE_SSL` unset or set it to `true`.

## Production Schema

PostgreSQL migration:

```text
migrations/001_introspectropy_sros.sql
```

Run migrations:

```bash
npm install
npm run db:migrate
```

## Test

```bash
npm run test:smoke
```

If `DATABASE_URL` is present, the smoke test runs against PostgreSQL. Otherwise it uses local JSON fallback.

## Core API

- `POST /api/reflections`
- `GET /api/patterns`
- `POST /api/patterns/:id/experiment`
- `GET /api/alerts`
- `POST /api/interceptions`
- `GET /api/dashboard`
- `POST /api/analytics`
- `GET /api/analytics-dashboard`

## Migration Report

See:

```text
MIGRATION_REPORT.md
```
