# Introspectropy SR-OS

Introspectropy SR-OS is an Insight Processing Infrastructure powered by the Introspectropy Classification Engine.

It is not a journal.

It is not a chatbot.

It is not therapy.

The system stores reflections as evidence, extracts behavioral signals, links recurring friction points into active patterns, maps assumptions, and supports micro experiment tracking.

Phase 2 adds guided onboarding, reflection guidance, terminology explanations, the lightweight Tigris guide companion, value communication pages, pricing architecture, enterprise architecture, and product usage analytics.

## Canonical Flow

Reflection
-> Pattern Class Detection
-> Pressure Point Weighting
-> Assumption Mapping
-> Micro Experiment
-> PIR Logging

## Core Framework Language

- The Performed Self
- Over-Outward Identity
- The Fulcrum
- Identity Drift
- Behavioral Drift

## User Experience Layer

- Guided tour with skip, next, finish, and Take Tour replay controls.
- Reflection guidance with examples and starter prompts.
- Plain-language tooltips for specialized SR-OS terms.
- Pattern hypothesis language for single reflections, with recurring pattern language reserved for multiple related reflections.
- Tigris companion for contextual instructional tips. Tigris is not an AI agent in this phase.

## Value Communication

The app includes Why Introspectropy, Pricing, Enterprise, and Analytics sections. These sections explain platform value before methodology while preserving the established framework.

## Primary KPI

Pattern Interception Rate:

```text
intercepted_consciously / (intercepted_consciously + repeated_unconsciously) * 100
```

`not_sure` is stored but excluded from the denominator.

## Database Setup

The production runtime uses PostgreSQL when `DATABASE_URL` is set. Local JSON remains available only as a development fallback when `DATABASE_URL` is absent.

Install dependencies before running PostgreSQL-backed commands:

```bash
npm install
```

Required environment variables:

```bash
DATABASE_URL=postgres://user:password@host:5432/database
APP_ORIGIN=https://your-domain.example
PORT=3000
```

For Supabase, use the project database connection string:

```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

The Supabase publishable key is not sufficient for migrations or backend persistence.

Optional:

```bash
DATABASE_SSL=false
```

Use `DATABASE_SSL=false` for local PostgreSQL. Hosted PostgreSQL should normally omit it.

## Migration Run Instructions

The PostgreSQL schema is defined in:

```text
migrations/001_introspectropy_sros.sql
```

Run:

```bash
npm run db:migrate
```

## Test Command

With `DATABASE_URL` set, the smoke test validates the SR-OS workflow against PostgreSQL. Without `DATABASE_URL`, it validates the same storage abstraction against local JSON.

```bash
npm run test:smoke
```

## Known Limitations

- ICE remains deterministic keyword/weight based for MVP validation.
- PostgreSQL persistence currently uses a whole-state synchronization adapter to preserve existing API behavior.
- Concurrent write handling should be replaced with targeted SQL mutations before high-volume use.
- Analytics are event-count based for MVP validation and do not include session replay or attribution modeling.
