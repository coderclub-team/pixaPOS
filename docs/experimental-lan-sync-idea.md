# EXPERIMENTAL — LAN Sync Layer (idea only, not in use)

> Do not implement from this file. Do not import it. Design sketch only.

## Goal

Add an offline-first LAN sync layer under the existing pixaPOS SaaS
(Next.js + React + TS + Neon Postgres + Better Auth) with minimal disruption.
Online behavior stays exactly as today.

## Invariants

- Only `/pos` may become LAN Master (manual designate; second claimant → 409).
- `/kot`, `/kds`, `/kiosk`, `/dashboard` are full SQLite clients on LAN.
- `/qr` is thin/ephemeral: no local DB, reads Master on LAN / cloud online.
- Reuse domain models; no second order system; Neon stays cloud truth.
- Reference data (menu/prices) frozen offline — cloud-only edits.
- Prior pairing mandatory (staff session or kiosk PIN → `pixa_device`, 7d TTL).

## Stack

EXISTING pixaPOS + LOCAL DATABASE (OPFS SQLite `pixa.db`)
+ EVENT LOG (`events` + outbox `CommandEnvelope{command_id,device_seq}`)
+ SYNC ENGINE (push existing; pull via `sync_state` cursors)
+ LAN MASTER/CLIENT (HTTP push/pull, SSE+poll fan-out, no WS in v1)

## Protocol

- Push: `POST /api/sync/push {commands}` → `appliedCommands` dedup → apply → per-command ack.
- Pull: `GET /api/sync/pull?entity_type&cursor&limit` → `PullPage{rows,cursor,has_more}`.
- Conflicts (`packages/contracts` CONFLICT_POLICY): kot `append_only`,
  order/table `version_check`, payment/refund `never_overwrite` → human review queue.
- Auth offline: `requireBaUser` fallback synthesizes identical claims; never mint fresh trust.

## Cutover order

P0 surface picker → P1 SQLite mirror → P2 outbox all entities →
P3 real pull → P4 master designate/health → P5 master apply →
P6 domain cutover (orders/KOT → payments → tables → reference one-way) → P7 ops.

## Known risks

- Vercel can never be a LAN master (needs on-prem runtime).
- Wi-Fi roam breaks `local.pixapos.store` hosts entries — static IP/DHCP reservation for master.
- Neon scale-to-zero cold starts — warmup hit, orthogonal to LAN correctness.
