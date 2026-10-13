# pixaPOS test suites

Two suites, two runners. Both run from the repo root.

## Unit + integration — `pnpm vitest`

```bash
pnpm vitest            # everything: unit + integration
```

- Config: `vitest.config.mts` (jsdom, `@/` → `apps/web`, serial files).
- Unit tests live in `tests/unit/` plus co-located `__tests__/` dirs.
- Integration tests live in `tests/integration/` and hit **real Postgres**.

### Integration database setup (one time)

Integration tests never touch production. They require an isolated database:

```bash
# 1. Create it (same Neon project, separate database):
#    CREATE DATABASE pixa_test;  -- via Neon console or SQL
# 2. Migrate it:
DATABASE_URL="postgresql://<role>:<pw>@<host>/pixa_test?sslmode=require" \
  pnpm exec drizzle-kit migrate --config ./drizzle.config.ts
# 3. Export it for every test run:
export DATABASE_URL_TEST="postgresql://<role>:<pw>@<host>/pixa_test?sslmode=require"
pnpm vitest
```

`tests/helpers/db.ts` enforces this fail-closed: it throws unless
`DATABASE_URL_TEST` is set, refuses when it equals `DATABASE_URL`, and
refuses database names without "test" in them. `resetTestDb()` truncates
all app tables (`CASCADE`) between tests; route handlers under test get
`@pixa/db`'s `db()` pointed at the test database via module mock so
`DATABASE_URL` itself is never aliased.

## E2E — `pnpm playwright`

```bash
pnpm playwright          # boots its own :3111 dev server, runs Chromium
```

- Config: `playwright.config.ts`. The managed dev server overrides
  `BETTER_AUTH_URL` to the e2e origin — never reuse a stray manual server
  (`reuseExistingServer` is off unless `PW_REUSE_SERVER=1`).
- Auth is deterministic: unique `@test.local` users per test plus the
  static phone OTP (`OTP_STATIC_CODE` from `apps/web/.env.local`, default
  `123456`). Override with `PLAYWRIGHT_STATIC_OTP`.
- Each test does the full funnel (sign-up → phone verify → onboarding),
  so the shared dev DB accumulates `E2E *` orgs — harmless, clearly named.
  To run against another port: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:XXXX`.
