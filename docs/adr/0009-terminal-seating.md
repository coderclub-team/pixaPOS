# ADR-0009: Seating merged into the order terminal

Date: 2026-09-11 · Status: accepted

## Context

Floor staff worked two surfaces: `/dashboard/tables` (seating, status) and
`/dashboard/order-terminal` (bill). Problem tables (blocked, cleaning,
out-of-service) were dead-ends in the terminal, the Tables view had a dead
View Order button and an unreachable cancel-occupancy dialog, and there was no
reason-audited direct status writer.

## Decisions

1. **Terminal owns seating.** The bill panel opens with a collapsible Seating
   section (occupancy + seat/release/transfer/clean/block + direct status set
   + cancel for order-less groups). Same service commands as the Tables view;
   UI not shared, so the Tables route is provably unchanged.
2. **`setTableStatus` is the only new status writer.** Reason-mandatory,
   constrained to legal next states from the transition map (UI offers only
   those); occupied→available is rejected with guidance toward the normal
   release→cleaning→mark-cleaned path. Emits `TABLE_STATUS_SET`.
3. **Problem tables managed inline.** Cleaning → mark-cleaned; blocked →
   unblock; out-of-service → set back to available; reserved → seat or cancel
   hold. No more "resolve it from the Tables view".
4. **Tables leaves the sidebar** (route still renders for direct links).
   Tables-view dead View Order button now navigates to the order workspace.

## Consequences

- One working screen for floor staff; Tables route retained as a read-mostly
  fallback until it adopts SeatingSection (deferred, deliberate).
- Direct status writes are audited but permission-open; add role gating if
  abuse appears.
