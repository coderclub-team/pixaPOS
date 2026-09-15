# ADR-0013: Shared-table parties — per-party chips and hold-to-order

Date: 2026-09-15 · Status: accepted

## Context

One table can host several unrelated parties (`allows_sharing`, multiple
`OccupancyGroup` rows, per-group `order_id`). The floor canvas showed only
aggregate seat dots, and `ensureTableOrder` was table-scoped (first group
wins), so staff could not see or serve parties individually. Toast and
Lightspeed solve the same problem with seat numbers + order-by-seat inside one
check; pixaPOS keeps one order per party instead.

## Decisions

1. **One chip per party, not per seat.** A chip maps 1:1 to the
   `OccupancyGroup` that owns the order. Auto label (A, B, C…) + fixed
   8-colour palette assigned at seating (`label`, `color_index` on the group);
   labels renamable later without touching identity. Per-seat dots are retired
   from the canvas — the party's seat count rides on its chip badge.
2. **Gesture map (terminal + ops floor): tap selects, hold orders.** Tap a
   table = today's select + bill panel. Tap a chip = focus that party's bill,
   never creates an order. 500 ms press-and-hold (Shift+Enter for keyboard) =
   `ensureGroupOrder` + picker opens directly. Editor canvas keeps full pointer
   control; chips are non-interactive there.
3. **`ensureGroupOrder` is the party-scoped twin of `ensureTableOrder`.**
   Same guards (out-of-service, cleaning), per-group lock, race re-check,
   best-effort `attachOrder`. One live order per party is preserved; add-ons
   fire extra KOTs onto the same order.
4. **No state-machine changes.** Table/order/kitchen/payment machines,
   release guards, capacity invariant, and transfer rules are untouched.
   Selection is UI-only state, not audited.
5. **Settings pages scale by filter, not redesign.** Tables list gains
   status/sharing filters, a sharing column with inline toggle, and the floors
   list gains live table/seated rollups from cached layout queries.

## Consequences

- Shared (communal) tables become first-class in the terminal with zero extra
  taps on the happy path: see parties → hold chip → pick items.
- Chips cap at 4 visible + "+N more"; very large parties rely on the bill
  panel party strip. Revisit if communal tables routinely exceed this.
- Seat-level ordering (Toast-style order-by-seat within one party) is
  explicitly out of scope; a party shares one bill.
