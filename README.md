# Introspectrophy — Fulcrum Guide

A publishable full-stack version of the Lovable prototype at `https://introspectrophy-fulcrum-guide.lovable.app`.

The app now includes:

- A polished responsive frontend for onboarding, calibration, readings, protocols, journal, library, dashboard, export, and deletion.
- A Node backend with no third-party runtime dependencies.
- Email/password accounts with HttpOnly cookie sessions.
- Persistent JSON storage at `data/db.json`.
- API routes for auth, profile data, questions, readings, journal entries, protocol completions, library state, dashboard metrics, and data export.

## Run Locally

```bash
npm start
```

Then open `http://localhost:3000`.

If Node is not on PATH in Codex Desktop, use the bundled runtime:

```powershell
& "C:\Users\micha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

## Environment

Copy `.env.example` into your host/provider settings:

```bash
PORT=3000
DATA_FILE=./data/db.json
APP_ORIGIN=https://your-domain.example
```

## Publish

This app can be deployed to Render, Railway, Fly.io, or any Node host.

- Build command: none
- Start command: `npm start`
- Persistent disk: mount a writable volume for `data/` if you want readings to survive deploy restarts.

For a larger production launch, the next natural upgrade is moving `data/db.json` to Postgres, Supabase, or another managed database. The current version is publishable on a Node host with a persistent disk and already supports accounts, saved readings, journal entries, protocol completions, and export/delete controls.
