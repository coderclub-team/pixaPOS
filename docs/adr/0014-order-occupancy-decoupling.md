# ADR-0014: Orders and KOTs independent of table occupancy

Date: 2026-09-15 · Status: accepted

## Context

Releasing a table locked its order (`ORDER_LOCKED`): no item adds, qty
changes, discounts, KOT voids, or KOT qty increases until reseated. In real
service guests often leave the table before paying (pay at counter, move to
the bar), and the table must reseat while the old bill settles. The lock also
forced a `cleaning` detour on every release-with-open-order.

## Decisions

1. **Occupancy governs seats; the bill governs money + food.** `releaseOccupancy`
   with an open order is a normal release (reason recorded): the group goes
   `RELEASED`, keeps its order pointer for history, and the order stays open,
   editable, and payable. `forceReleaseOccupancy` remains as a compat alias.
2. **All occupancy gates on order/KOT mutations removed** (`assertTableOccupied`
   deleted): item add/qty/remove, discount, KOT void, KOT qty increase, and new
   fires all work on detached orders. Occupancy is enforced only where seats
   are at stake: `seatOccupancy` (capacity/sharing), `attachOrder`, and the
   ensure-create paths.
3. **Release with an open order returns the table to `available`** (new
   `occupied → available` edge, usable only via release — direct
   `setTableStatus` still rejects it with guidance). Release without an order
   keeps the `cleaning` hygiene path. Staff are reminded to clean before
   reseating; block/status stays one tap away in TableOpsDialog.
4. **Detached bills stay visible as "open tabs"** — live orders on a table
   whose party is gone surface in the terminal party strip and TableOpsDialog,
   so freed tables never hide money. `ORDER_LOCKED` is history-only.
5. **Customer unlink/re-link.** Staff can unlink a wrongly linked customer
   (confirm dialog, optional reason, audited as `ORDER_CUSTOMER_UNLINKED` with
   the previous snapshot in metadata) and link the correct one; blocked on
   terminal order states like linking.

## Consequences

- One release path, no force variant in UI; release dialog copy states the
  order stays open.
- Tables can host a new party while the previous bill settles — reports must
  join orders by `table_id` + time, not by live occupancy (already the case
  via snapshots).
- The cleaning bypass on release-with-order is deliberate (operator choice);
  revisit if hygiene compliance becomes an issue.
