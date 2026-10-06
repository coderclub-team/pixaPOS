# pixaPOS Product Review — UI/UX + Environments + CI/CD

Read-only senior review of the `develop` branch, plus the pipeline executor added
alongside it. Evidence is cited as `file:line`. Severity: **P0** breaks core
function/trust · **P1** significant UX/a11y/trust · **P2** polish/consistency.

## 1. Executive verdict

The product is a **strong, cohesive design system wrapped around mostly
demo-grade persistence**. Admin and dashboard shells, forms, dialogs, tokens and
surface routing are disciplined and consistent; the weak points are data
plumbing (most operational modules are `localStorage` mocks), placeholder
surfaces advertised as live, and missing error/loading boundaries outside a few
pockets. CI/CD is well-structured for a 3-tier flow but has parity gaps
(no real auth smoke, silent migration skips, `release/*` drift).

**Overall:** ship-ready as a **demo/pilot for admin + back-office**; not yet
operationally trustworthy for **multi-device POS ↔ KDS**.

## 2. Scope & method

- 124 `page.tsx`, 35 API routes, 19 feature domains.
- Audited all of `app/admin`, `app/dashboard`, and the operational surfaces
  (`pos`, `kds`, `kot`, `kiosk`, `order`, `dispatch*`, `rider`, `shop`, `qr`,
  `onboarding`, `auth`, marketing) plus `proxy.ts`/`lib/hosts.ts` and CI.
- Data backing classified from `features/*/api/service.ts`.

## 3. Surface map & backing

| Group | Routes | Data backing |
| --- | --- | --- |
| Admin console `/admin` | 13 | Drizzle/Neon (all) |
| Dashboard `/dashboard` | ~85 | Mostly `localStorage` mocks; `rbac` + workspaces + teams = real Neon |
| POS/KDS/KOT/Dispatch/Rider | 9 | `localStorage` + per-device SQLite mirror + outbox; sync endpoints are skeletons |
| Kiosk/Order/Shop/QR | 4 | Public placeholders ("coming soon") |
| Onboarding | 1 | Real Neon |
| Auth | 2 | Real Better Auth |
| Marketing | ~5 | Static |

**Cross-device gap (P0):** `api/sync/push` records idempotency keys but applies
no entities (`app/api/sync/push/route.ts:10-12,47-54`) and `api/sync/pull`
always returns `rows: []` (`app/api/sync/pull/route.ts:5-27`). A POS tablet and a
KDS wall tablet on one outlet do not share orders/KOTs — the core product
promise.

## 4. Cross-cutting findings

### P0

1. **No cross-device data path** (above). Every operational surface is affected.
2. **No error boundaries** on POS/KDS/Dispatch/Rider/onboarding/admin — a runtime
   throw falls to Next's default error page, losing offline-safe UX. Only
   `dashboard/overview/@*/error.tsx` and `dashboard/users/loading.tsx` exist.
3. **Admin overview KPI links 404** — cards linked to `/organizations`,
   `/billing`, `/leads` instead of `/admin/...`. **Fixed in this change**
   (`app/admin/(console)/page.tsx`).

### P1

4. Placeholder surfaces (Kiosk, QR/Order, KOT, Shop) are advertised as delivered
   in `components/site/surfaces.tsx:15-34` while their subdomains route live
   (`lib/hosts.ts:37-45`).
5. Tenant custom domains (`www.<restaurant-domain>`) fall through to the platform
   marketing site (`lib/hosts.ts:59-75`) instead of a tenant website.
6. `captain.*` maps to the counter `/pos` terminal (`lib/hosts.ts:37`), not
   captain/steward ordering.
7. `/rider` requires a restaurant session while rider identity is an
   unauthenticated `localStorage` string (`app/rider/shell.tsx:22-30,141-147`) —
   spoofable.
8. **Demo data presented as real KPIs** in two overviews: dashboard
   (`app/dashboard/overview/layout.tsx:42-101`) and admin charts (static
   `features/overview` graphs now mounted on `/admin`).
9. Destructive actions without confirmation outside the dialog pattern: lead
   approve, messaging bulk send, CRM `→ lost`, ticket `→ closed`, team/UPI/table
   removals, dispatch complete.
10. No password reset flow anywhere (auth forms).
11. `apps/web` has **no local `lint`/`typecheck` scripts**; root `turbo run`
    silently skips it (only `@pixa/template` ran during `pnpm typecheck`).

### P2

- Raw Tailwind palette instead of semantic tokens (~269 utilities + hardcoded
  `bg-zinc-950`, `bg-white`, `text-emerald-700` in admin/dashboard/KDS/terminal).
- Create-pattern split: dialog (billing) vs inline card (crm/tickets/messaging/
  integrations/users/roles) vs header-inline (org edit).
- Empty-state split: `Empty` primitive vs hardcoded `<p class="bg-white…">`.
- No per-page `metadata`; no `h1` (Heading is always `h2`).
- Icon-only buttons relying on `title`; unlabeled `SelectTrigger`s (~141).
- Marketing carries fake team/testimonials/Lorem and has no legal pages;
  `ScrollToTop` not keyboard-operable.

## 5. Admin console (post-change)

Now uniformly wrapped in `PageContainer` with titles/descriptions; sign-out and
plan create are **dialogs**; Add Plan is top-right; overview shows graphs.
Remaining:

- P1 — lead "Approve → create org" and messaging "Send now" need confirmation.
- P1 — CRM/ticket terminal transitions one-click; integrations Delete icon lacks
  accessible name; roles seed is a **render-time DB write**
  (`app/admin/(console)/roles/page.tsx:29-54`); billing DB-down is silent.
- P1 — org detail swallows `notFound()` in its `catch`
  (`organizations/[id]/page.tsx:35,43`).
- P2 — create-pattern split, header-action mobile overflow, notification center
  links leak to restaurant routes, no `loading.tsx`/`error.tsx`, hardcoded
  colors.

## 6. Dashboard

- P1 — overview is 100% hardcoded (revenue/customers/charts).
- P1 — `/dashboard/users` uses in-memory `fakeUsers` while real membership lives
  in `/dashboard/workspaces/team` (duplicate, non-persistent).
- P1 — no `error.tsx`/`not-found.tsx`; list/detail pages read only `isPending`
  (failures render as empty).
- P1 — team/UPI removals unconfirmed.
- P2 — nav IA (marketing under inventory, duplicate shortcuts, orphaned
  `order-terminal`/`kitchen`/`tables`/`profile` routes), header contract split,
  token/palette cleanup, `window as any` debounce timers.

## 7. Operational surfaces

- **POS** — best-built surface; tablet-first, accessible, but demo-grade across
  devices, no error boundary, remote menu images break offline.
- **KDS** — strong states + shared board; touch targets 36px (<44px guideline),
  channel secret in client bundle, no fullscreen lock.
- **Kiosk/Order/Shop/QR/KOT** — placeholders; inherit the wrong PWA manifest
  (start_url `/dashboard/overview`).
- **Dispatch/Run/Rider** — clean kanban/run sheet; one-tap complete, N+1 billing
  queries, rider spoofing.
- **Onboarding** — real DB; missing inline validation, uncaught `fetch`
  rejection, page-level gate missing (middleware only).
- **Auth** — accessible cards; no password reset; bypasses `useAppForm`.
- **Routing** — gates correct; host map diverges from the documented subdomain
  map (captain, tenant domains, shop/dispatch/rider).

## 8. Environment matrix

| Concern | local | dev (`develop`) | stage (`test`) | prod (`main`) |
| --- | --- | --- | --- | --- |
| `APP_ENV` | dev | dev | stage | prod |
| DB | local/Neon | `DEV_DATABASE_URL` | `STAGE_DATABASE_URL` | `PROD_DATABASE_URL` |
| Cookies | host-only | `.pixapos.store` | `.pixapos.store` | `.pixapos.store` |
| Razorpay | test | test | test | live |
| OAuth | localhost URIs | dev URIs | — | prod URIs (manual) |
| Hosts | `local.pixapos.store` | `*.develop.pixapos.store` | path/`test.*` | `*.pixapos.store` |

Gaps: Google redirect URIs are a manual per-origin step
(`docs/auth-cutover-runbook.md`); `NEXT_PUBLIC_APP_URL` etc. absent from
`.env.example` intent (CTAs default to localhost); branch previews always serve
marketing at `/` (documented).

## 9. CI/CD assessment

**Good:** `.github/workflows/ci-cd.yml` is a clean 3-tier pipeline
(`develop→dev`, `test→stage`, `main/v*→prod`) with `validate → build → migrate`,
per-tier secrets, tag→prod mapping, and Vercel Git integration doing deploys.
`protect-main`/`protect-test` rulesets require `validate`+`build`.

**Gaps:**

1. `build` uses a **dummy** `BETTER_AUTH_SECRET` — never smoke-tests real auth.
2. `migrate` **silently skips** when a tier secret is unset (`exit 0`) — a missing
   secret looks green.
3. `vercel.json` enables `develop/test/main` but not `release/*`, which
   ADR-0019 references (drift).
4. `develop` has **no ruleset** (direct pushes allowed) — okay for velocity,
   worth noting.
5. No post-deploy health gate per tier.

## 10. Pipeline executor added

`scripts/pipeline.mjs` (dependency-free) + root scripts, mirroring the workflow:

```text
pnpm pipeline:status              # tier map + branch state
pnpm pipeline:verify              # format:check + lint + typecheck + web build
pnpm pipeline:migrate <tier>      # apply migrations (prod guarded by --yes)
pnpm pipeline:health [url...]     # probe /api/health across surfaces
pnpm pipeline:deploy <tier>       # verify then push the tier branch
```

Tier map: `dev→develop`, `stage→test`, `prod→main`. Prod actions require
`--yes`/`CONFIRM_PROD=1`. Recommended follow-ups: make CI call
`pipeline:verify`, fail (not skip) `migrate` when the tier secret is missing, add
`release/*` to `vercel.json`, and run `pipeline:health` after each deploy.

## 11. Prioritized backlog

**P0** — cross-device sync (apply entities in `sync/push`, hydrate `sync/pull`);
error boundaries on operational surfaces; ~~admin KPI links~~ (fixed).

**P1** — remove/withhold placeholder marketing claims; tenant-domain fallback;
wire real data into both overviews; add confirmations to the listed destructive
actions; fix `/rider` identity; add dashboard `error.tsx`/`not-found.tsx`; retire
`fakeUsers` in favour of real membership; add `apps/web` lint/typecheck scripts;
password reset.

**P2** — unify create/empty/header patterns; tokenize colors; per-page metadata +
`h1`; label icon buttons/selects; marketing content + legal pages; KDS touch
sizing; CI parity items in §9.
