# ADR-0006: Order terminal for reception capture

Date: 2026-09-11 · Status: accepted

## Context

Reception staff need a dedicated capture screen: floor view, tap a table,
record the customer order. It must run in a separate browser tab while the
Clerk session persists, without duplicating floor or menu-picker logic.

## Decisions

1. **Route `/dashboard/order-terminal`** under the dashboard layout, so
   `auth.protect()` applies. Clerk sessions are same-origin cookies — no extra
   auth work is needed for multi-tab use.
2. **Reuse, don't rebuild.** Operations-mode `FloorPlanCanvas` for the floor;
   extracted `ItemPicker` (shared with `/orders/[id]/add`) inside a large
   order dialog. The `/add` page is now a thin wrapper — no behavior change.
3. **`ensureTableOrder` auto-create policy.** Tap resolves the table's live
   order (newest non-terminal); otherwise creates a DRAFT dine-in order,
   seats a default party (free seats, else full capacity) when no active group,
   and attaches via the existing `attachOrder`. Serialized on a per-table mutex
   with a post-seat live re-check, so double-taps can't create two drafts.
   Blocked/cleaning/out-of-service tables show guidance instead of the picker.
4. **Terminal is capture + fire.** The dialog fires KOTs (same `fireKOT`
   command, same audit events). Voids, transfers, and payment stay in the
   order workspace / Tables view — no logic duplicated.
5. **No server prefetch** (localStorage-mock rule): client fetches in Suspense.

## Consequences

- One picker component serves two surfaces; menu changes propagate to both.
- Live-orders rail links into the full workspace for exceptions.
