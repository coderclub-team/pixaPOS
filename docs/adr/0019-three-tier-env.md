# ADR-0019: dev → stage → prod three-tier environments

Date: 2026-09-19 · Status: accepted

## Context

Two implicit tiers (local dev + Vercel preview/prod sharing one DATABASE_URL
lineage) cannot express pre-production verification. This ADR makes three
explicit, isolated tiers.

## Decisions

1. **Neon branches**: `dev` = existing main branch; `stage` = copy-on-write
   clone of `prod` (br-still-firefly-b3ksnzlc); `prod` = fresh branch
   (br-rough-shape-b37awfnj). Migrations promote dev → stage → prod, never
   prod first; stage is re-branched from prod when it drifts.
2. **Functions**: one `kdsfeed` deployment per branch with distinct
   `KDS_FEED_SECRET`; client routes via per-tier `NEXT_PUBLIC_KDS_FEED_URL`.
   Both stage and prod health checks return 200.
3. **Storage**: single `menu-images` bucket; branches inherit objects
   copy-on-write, writes stay isolated. `PIXA_IMAGE_BUCKET` remains the escape
   hatch. Per-tier branch-scoped `AWS_*` creds.
4. **Code**: `APP_ENV` tier selector (`lib/env.ts`, zod-validated, fail-fast);
   dev-bypass allowed on dev only (authz + boot enforcement); `turbo.json`
   tracks `APP_ENV`; `vercel.json` pins region `bom1` and deploys
   `main` + `release/*`; CI (`promote.yml`) validates all pushes and migrates
   the matching tier on push (tags → prod).
5. **Secrets**: Razorpay test keys on dev/stage, live on prod only. Google
   OAuth test client on dev/stage, prod client on prod (+ redirect URIs per
   origin). `BETTER_AUTH_SECRET` distinct per tier.

## Consequences

- Vercel needs three env scopes wired: Preview (dev values), a staging target
  (stage values), Production (prod values).
- Preview deployments keep working with dev values; `release/*` branches
  exercise the full stage stack before tags promote to prod.
- `NEON_API_KEY` used for provisioning stays operator-side, never in repo or
  Vercel env.
