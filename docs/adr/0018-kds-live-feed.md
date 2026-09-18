# ADR-0018: KDS live feed on a Neon Function

Date: 2026-09-18 · Status: accepted (pilot, function deployed but unreachable — see below)

## Context

The KDS wallboard polls every 5s. Neon Functions fits exactly this slice:
a long-lived SSE stream next to Postgres. Domain services stay on Vercel
(short request/response); only the fan-out moves.

## Decisions

1. **`kdsfeed` function** (`functions/kdsfeed`, Hono + SSE): POS/KDS tabs POST
   ticket events (fire-and-forget, never throws into mutations); wallboards
   subscribe with `?token=`. Cross-isolate fan-out via Postgres `kds_feed`
   table (1s poll per isolate, cursor-based); 25s heartbeat; per-isolate
   client sets. Shared-secret auth (internal wallboard, no end-user data).
2. **Client**: `useKitchenFeed` subscribes, invalidates board on events, shows
   Live/Polling indicator; poll slows to 30s while live, stays 5s fallback.
   `publishTicket` fires from `mutateTicket` + `fireKOT` (keepalive, silent
   catch). Env: `NEXT_PUBLIC_KDS_FEED_URL/SECRET` (Vercel preview+prod set).
3. **Deploy path**: CLI v5 has no functions commands — deployed via the
   documented multipart API (esbuild ESM bundle + zip). `neon.ts` omitted
   (inert without CLI support); revisit when CLI catches up.

## Status / blocker

Deployment `completed` on branch `feat/kds-live-feed`, but the invocation URL
returns **404 "function not found"** — the build likely failed silently or the
bundle entry shape mismatches the runtime. Next: pull branch function logs
(`neon logs` has no function source in this CLI; use Console/API), fix the
bundle (verify Hono default-export interop + `@neon/functions` attach call),
redeploy. Client code is live and safely degrades to polling until then.
