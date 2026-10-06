# pixaPOS Feature Audit — `develop` (2026-09-28)

> Method: `grep/glob/read` only. Statuses: **DONE** = code-complete with UI + service + guard;
> **PARTIAL** = works but stub/mock/placeholder remains; **MISSING/PLANNED** = docs/ADR only.
>
> Cross-cutting disclaimer: everything below except auth/PWA/sync-transport is
> **localStorage mock-backed** (`delay()` in services). Any "DONE" means UX + logic
> done — persistence is not Postgres yet (see ADR-0015).

## Status table

| #   | Area                                                       | Status                                            |
| --- | ---------------------------------------------------------- | ------------------------------------------------- |
| 1   | Offline-first (mirror, outbox, sync, pairing, PWA)         | PARTIAL                                           |
| 2   | Business hours modes + cut-off + scheduled guard           | DONE (mock-backed)                                |
| 3   | Add-ons/modifiers + required gating + alias printing       | DONE (mock-backed)                                |
| 4   | Upsell links + bestseller                                  | DONE (mock-backed)                                |
| 5   | Nutrition (FSSAI) + kcal chip                              | DONE                                              |
| 6   | Snapshots backup/restore + auto ring                       | DONE (localStorage scope)                         |
| 7   | Bulk CSV import/export + per-table sorting                 | PARTIAL (export+sort universal; import selective) |
| 8   | Barcode (goods item-level, search)                         | DONE                                              |
| 9   | Order lifecycle + cancel/complete/force + returns + events | DONE (mock-backed)                                |
| 10  | KDS / POS / dashboard / auth / roles                       | PARTIAL (kot + kiosk are placeholders)            |

## 1. Offline-first — PARTIAL

Works: SQLite mirror via wa-sqlite (`apps/web/lib/db/schema.ts:27`, `outbox.ts:49`,
`pendingOutboxBatch:82`, `markOutboxSynced:119`, `markOutboxFailed:154`);
sync engine (`lib/db/sync-engine.ts:1-116`, 30 s drain to hub/cloud);
idempotent push endpoint (`app/api/sync/push/route.ts:9`);
status UI (`components/sync-status.tsx:5-44`); device pairing
(`device-pair-bootstrap.tsx:7-20`, `api/device/pair/route.ts:9`,
`lib/device-token.ts:2`); offline grace gate (`proxy.ts:11-14,38-53`);
PWA root manifest (`app/manifest.ts:1-21`), SW (`public/sw.js:21-35`).

Gaps:

- Server never applies pushed snapshots to Postgres — `sync-engine.ts:7-9` says so
  explicitly; `packages/contracts/index.ts:6` is aspirational.
- No conflict UI (`conflicted` state per `workflows.md:9` missing; only
  pending/failed/synced counts).
- Per-surface `pos|kds|kiosk/manifest.webmanifest` referenced but no emitting
  route files found — **verify before release** (correction #2).

## 2. Business hours — DONE (mock-backed)

Model (`features/outlet/api/types.ts:59-77`), schema (`schemas/outlet.ts:143-154`),
form (`business-hours-form.tsx:21-24,140,211,235-249`), helpers
(`service.ts:102-199`: `isChannelOpen`, `nextOpeningToday`, `channelMode`,
`channelCutoff`, `minutesToClose`), guard choke point
(`features/orders/api/service.ts:331-367`).

Gap: no `requires_staff`/`staff_only` outlet flag — only `input.staff_initiated`
bypass for scheduled orders. Staff reopen = editing hours (correction #3).

## 3. Add-ons/modifiers — DONE (mock-backed)

CRUD (`features/menu/api/service.ts:529-587`, alias trim `:556,586-587`),
item linking (`createMenuItem:343`, `updateMenuItem:405-406`),
dashboard (`dashboard/menu/modifiers/*`, `modifier-group-form.tsx`,
`modifier-options-manager.tsx`), required gating server
(`features/kitchen/api/service.ts:281-293`) + picker mirror
(`item-picker.tsx:501`), alias printing
(`kitchen/service.ts:324`, `kds-board.tsx:464-467`, golden fixtures
`scripts/print-golden-check.ts:90`).

Deferred by design: no raw-material mapping (types comment).

## 4. Upsell — DONE (mock-backed)

Model (`menu/api/types.ts:80-83`), schema (`menu-item.ts:47-49`),
persistence (`menu/service.ts:339-341`), form (`menu-form.tsx:125-126,248-250,
298-300,1295-1296`), browser badge (`item-browser.tsx:699`),
picker row (`item-picker.tsx:513`). Manual links only, by design.

## 5. Nutrition — DONE

Type (`menu/api/types.ts:19-26`, FSSAI §5(3)), schema (`menu-item.ts:15-18,47`),
persistence (`menu/service.ts:339`), form (`menu-form.tsx:131-160,1226,1238-1275`),
chip (`item-browser.tsx:719-720`); outlet FSSAI (`outlet/types.ts:28`,
`fssai-form.tsx:6-46`, 14-digit check `schemas/outlet.ts:77-78,115-119`),
print (`print-studio/api/docs.ts:54-55`, fixtures).

## 6. Snapshots — DONE (localStorage scope)

Service (`features/system/api/service.ts`: prefs `:45`, collect/download `:58-79`,
daily auto ring keep-5 `:99-122`, strict parse `:134-141`, restore `:151-159`),
UI (`snapshot-panel.tsx:36-204`), page
(`dashboard/settings/outlet/operations/data/page.tsx`).
Not Postgres/Neon backups — do not confuse with Drizzle snapshots.

## 7. Bulk CSV IO + sorting — PARTIAL (verified per-table matrix, 2026-09-28)

Infra DONE: `system/lib/csv.ts:7-112`, `io-dialog.tsx:16-156`
(sample download, preview, missing-column check, `ExportButton`),
`sort-th.tsx` shared sorting.

| Table | Import | Export | Sort |
|---|---|---|---|
| Menu items / categories / modifiers | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ | ✅ |
| Raw materials / suppliers | ✅ | ✅ | ✅ |
| Tables / floors | ✅ | ✅ | ✅ |
| Orders / refunds | — (transactional) | ✅ | ✅ |
| Purchases / POs / returns / payments / credits | — | ✅ | ✅ |
| Stock / supplier ledgers / waste / recipes | — | ✅ | ✅ |
| Users | — (invite flow) | ✅ | ✅ |
| Roles / billing history | — (sensitive) | — | ✅ |

Rule: master data imports (upsert by natural key); transactional, user,
and sensitive tables are export/sort-only by design.

## 8. Barcode — DONE

Item-level (`menu/api/types.ts:61-62`, persist `service.ts:308,329,389`,
search `service.ts:235-240`); variant barcode (`types.ts:43`);
inventory barcodes + uniqueness (`inventory/service.ts:54,97,161,597-598,627,657`).
Typed/scan-to-search only — no dedicated scanner widget.

## 9. Order lifecycle — DONE (mock-backed), consistent with `workflows.md`

Map (`orders/service.ts:145-151`), DRAFT semantics
(`:655-656,789,843-845,911-913,1007`), first fire `DRAFT→IN_KITCHEN`
(`kitchen/service.ts:257-264,354`), kitchen propagation + silent backfill
(`orders/service.ts:1669-1767`), `completeOrder:1774-1822`
(normal needs SERVED `:1809`, force needs reason `:1813`),
`createReturn:1138` (SERVED/COMPLETED, reason-mandatory),
events union matches `workflows.md:153`.
Re-verify: generic `cancelOrder` auth path past-PREPARING (correction #4).

## 10. KDS / POS / dashboard / auth / roles — PARTIAL

KDS (`kds-board.tsx`, 5 s poll), POS terminal
(`order-terminal-view.tsx:144`, `item-picker.tsx:21,119`),
~70 dashboard pages, Better Auth + org plugin
(`lib/auth.ts:5-8`, `auth-client.ts:1-2`, `auth-session.ts:18-58`),
kiosk PIN (`outlet/service.ts:218-229`, `device-token.ts:96-100`),
roles (`config/roles.ts`, `permissions.ts:1-87`, `nav-config.ts`),
`use-identity.ts:70-154`.
Placeholders by design: `app/kot` (reserved), `app/kiosk` (coming soon, public
per `proxy.ts:8-9`). Clerk→Better Auth cutover runbook exists; expect residual refs.

## Correction list (working through one by one)

1. [x] This report filed.
2. [x] Verify/fix per-surface PWA manifest routes — FIXED 2026-09-28:
       `app/{pos,kds,kiosk,qr}/manifest.webmanifest/route.ts` now emit tailored
       manifests (name/start_url/scope per surface); build lists all four routes.
3. [x] Staff-override flag — FIXED 2026-09-28 (owner chose outlet pref):
   `allow_off_hours_orders` + `require_off_hours_reason` on Outlet, switches in
   Order Settings, guard in `createOrder` flags `off_hours` + `ORDER_OFF_HOURS`
   event, terminal shows amber reason banner instead of hard block.
   Bonus fix: `ensureGroupOrder` used out-of-scope `tableId` → `group.table_id`.
4. [x] `cancelOrder` auth path — VERIFIED + FIXED 2026-09-28: service required
   `by` past-PREPARING but the bill-panel dialog never sent it (dead end).
   Panel now attributes the signed-in session user; dialog copy corrected;
   `workflows.md` cancel rule amended (actor + reason = authorization).
5. [x] Import-coverage claims — CORRECTED 2026-09-28: §7 now carries the
   verified per-table matrix (8 import tables; 13 export-only; roles/billing
   sort-only). No code change — the scope was already correct by design.
6. [x] Honest sync status — FIXED 2026-09-28: pill said "Synced" on mere
   transport ack. Now says "Sent" with tooltip "Sent to server — server-side
   apply lands next". Full `retrying/blocked/conflicted` states wait on
   server-side application (out of scope, tracked).
