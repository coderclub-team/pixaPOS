# ADR-0015: Local-first foundation — OPFS SQLite + Neon Postgres

Date: 2026-09-16 · Status: accepted

## Context

pixaPOS persists to localStorage JSON blobs with timestamp IDs, no outbox,
no device identity, and no sync — while `docs/architecture/` prescribes
SQLite-local + Postgres-central with an outbox sync engine. This ADR locks the
concrete stack and the phased path there.

## Decisions

1. **Local engine: real SQLite via wa-sqlite on OPFS** (`apps/web/lib/db/`,
   worker `public/sqlite-worker.js`). Browsers can't use SQLite files, but
   OPFS access handles in a dedicated Worker give durable, transactional
   storage. localStorage stays as a read-only fallback (private-mode Safari),
   never as a write path.
2. **Central DB: Neon Postgres** (`packages/db`, Drizzle schema, ULID ids,
   soft deletes, paise integers, idempotency ledger `applied_commands`).
3. **Contracts first** (`packages/contracts`): monotonic ULIDs, command
   envelope (idempotency key + device seq for causal order), outbox lifecycle
   (`pending → synced/failed/conflicted`), per-entity conflict policies
   (payments never overwrite, KOT append-only, inventory transactional).
4. **Foundation changes nothing live.** Services stay on mocks; the outbox
   helper, sync push/pull skeleton (flag-gated `PIXA_SYNC_ENABLED`), and
   migrations are additive. Cutover happens per domain in pilot phases:
   events → orders → kitchen → payments → inventory, each with its own PR.
5. **Sync safety rules**: settle-first and release-detach semantics carry over;
   retries re-send by `command_id` and can never double-apply money.

## Consequences

- New deps: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`,
  `wa-sqlite`, `tsx`. Vendor wasm/js copied to `public/vendor/wa-sqlite`.
- `DATABASE_URL` (Neon pooled) required for migrations, seeds, and sync API.
- OPFS needs a Worker + secure context; verification matrix covers Chrome,
  Safari (fallback path), and the Vercel preview build.
