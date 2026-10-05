# ADR-0021: Multi-workspace/multi-outlet compliance gaps

Date: 2026-09-23 · Status: accepted (gaps tracked, not yet scheduled)

## Context

`docs/architecture/multi-workspace-multi-outlet.md` (adopted policy) was
audited against the codebase. Verdict: the project implements the doc's
single-outlet phase — boundaries hold, but everything beyond one outlet is
missing, plus one direct contradiction (billing scope).

## Conformant (keep)

1. No workspace-per-outlet code anywhere (cardinal rule holds).
2. `outlet_id` on all operational rows (orders, items, KOTs, lines, payments,
   refunds, customers, inventory txns, events, RBAC overrides) via the shared
   `audit` spread + indexes (`packages/db/schema.ts`).
3. Printers fully outlet-scoped end-to-end (`features/print-studio`).
4. Workspace identity = Better Auth organization (roles, membership, logo).

## Gaps (ranked)

1. **No `outlets` table/model.** Outlet is a `localStorage` singleton
   (`out_001`, `features/outlet/api/service.ts:25-28`). No second row, no
   switcher, no active-outlet context, no member-outlet-access table.
2. **No `workspace_id` in code/DB.** Zero columns/indexes; workspace joins
   work by convention only (`out_001 → org_001`).
3. **Billing is outlet-scoped; policy demands workspace-scoped.**
   ~~`Subscription.outlet_id`, per-outlet query keys, Razorpay reconcile keyed
   on outlet (`features/billing`).~~ **FIXED:** subscription + invoices keyed
   on `organization_id` (legacy outlet-keyed rows adopted once); query keys,
   view, page, subscribe route, and webhook reconcile on organization.
   Only the trial clock anchor already touched the org.
4. **Menu/suppliers are flat globals.** No workspace catalog, outlet
   availability/pricing, or supplier scoping (`RawMaterial.outlet_id?` is
   decorative; seeds hardcode `out_001`).
5. **Single-outlet hardcoding in ~20 sites** (`OUTLET_ID` constants,
   `out_001` literals, `seed.ts`). Second outlet = plumbing pass, not a flag.
6. **No workspace surfaces.** No workspace settings, dashboards, rollups, or
   `/o/<outlet>` URL context.

## Decisions

1. Second-outlet work starts with an `outlets` table + `workspace_id`
   migration (with backfill) + active-context plumbing — never a second
   workspace, never silent retrofits. Each piece ships with its migration,
   backfill, and service-layer enforcement together.
2. Billing re-scope (subscription → organization) rides the next billing
   change, not a standalone rewrite — until then the outlet-scoped
   implementation stands as documented tech debt.
   → DONE 2026-09-23: subscription/invoices on `organization_id`.
3. New outlet-owned tables MUST carry both `outlet_id` and `workspace_id`
   from day one (§11 of the architecture doc). Reviewers reject new tables
   with only one.
4. This ADR stays open until gaps 1–2 land; update its status then.
