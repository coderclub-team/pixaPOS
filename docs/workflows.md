# Restaurant Workflows

Source of truth for lifecycle state machines. Code and these docs must stay consistent. Transitions run only through domain-service commands that validate, side-effect, and emit business events.

## Local-first delivery rule

The current services are mock-backed. When durable local-first operation is
introduced, each transition below must be represented as an idempotent command
with a durable outbox record and visible `synced`, `retrying`, `blocked`, or
`conflicted` status. A transition is operationally complete only when its
canonical result is reconciled; the local event remains an audit record. See
`offline-and-sync.md` and ADR-0011. This rule does not alter the state
machines defined below.

## 1. Order lifecycle

```text
DRAFT → CONFIRMED → IN_KITCHEN → PREPARING → READY → SERVED → COMPLETED
```

Cancellation: `DRAFT → CANCELLED`, `CONFIRMED → CANCELLED`, `IN_KITCHEN → CANCELLED`. Past `PREPARING`, cancellation needs authorization and records who/when/reason/previous-state/financial + inventory impact.

- **DRAFT**: internal pre-fire cart — created by `/new`, never shown (list hides drafts, every surface labels it "New order"). No CONFIRMED step in new flows: the first fire walks `DRAFT → IN_KITCHEN` (auto-seating dine-in tables); exiting with zero fired KOTs discards the cart. CONFIRMED remains in the union for stored history only.
- **CONFIRMED**: order accepted — add items (each add fires a new KOT), send to kitchen, accept payment, policy-bound modify/cancel.
- **IN_KITCHEN**: ticket created; kitchen may begin. **PREPARING**: kitchen started (item-ready marks allowed; cancel needs auth). **READY**: awaiting pickup/serve/delivery. **SERVED** (dine-in). **COMPLETED**: normally `payment = PAID` + fulfillment done.
- **Kitchen → order propagation** (advance-only, never regresses): KOT accept/prepare/ready/serve walks the order `CONFIRMED → IN_KITCHEN → PREPARING → READY → SERVED` via `refreshOrderKitchenState` (voided tickets ignored). Loads also self-heal: `getOrders`/`getOrderById` backfill non-terminal orders forward to the same derived step (change-only, so steady state writes nothing). Backfill reconciles silently — it writes status without emitting events, so reloads never fabricate audit history; live transitions remain the sole event source. Completion is explicit via `completeOrder` — zero balance → `COMPLETED` (`ORDER_COMPLETED`); completing first marks every open KOT served (cash settlement means handover), then the normal path needs `SERVED` while the force path completes any settled order with a mandatory reason (audited).
- **Multi-KOT aggregation** (Toast/Lightspeed/Odoo rule): one order may hold N tickets; the order step is derived from *all* non-voided tickets — all `SERVED` → `SERVED`, all `READY`/`SERVED` → `READY`, any `PREPARING` work → `PREPARING`. An order is ready only when every item is ready; the shared `OrderKitchenProgress` readout (`done/total ready`) renders on the list, detail and terminal from the same derivation so every surface agrees.
- **Add-on reopen** (Aloha rule): firing new items onto a `READY`/`SERVED` order walks it back to `IN_KITCHEN` (audited, the only regression path) — settled status must never claim food that is still cooking.
- **Shared source**: the localStorage-backed mocks reload on every read and broadcast `storage` events (`useCrossTabSync`), so the KDS wallboard (5 s poll), terminal, list and detail converge on one truth across tabs.

## 2. Order-item workflow

Items transition independently — never assume item state == order state:

```text
ADDED → CONFIRMED → SENT_TO_KITCHEN → PREPARING → READY → SERVED (or CANCELLED)
```

Post-kitchen modifications create explicit adjustment events (record `-1 Burger / +1 Pizza` deltas, not silent edits).

## 3. Kitchen workflow (separate entity)

```text
NEW → ACCEPTED → PREPARING → READY → SERVED
```

Strict step-by-step: neither tickets nor lines may skip a step. Every item
walks its own line machine alongside the ticket:

```text
PENDING → ACCEPTED → PREPARING → READY → SERVED (or VOIDED from any non-terminal step)
```

ACCEPTED is acknowledgment, not a tollbooth: chefs accept items line by line
(`acceptKOTLine`; the first accept moves the ticket `NEW → ACCEPTED`), but
`PENDING → PREPARING` stays legal for bulk starts and fast paths. After
accept, multi-item tickets prepare line by line (`startPreparingKOTLine`);
the first started line moves the ticket `ACCEPTED → PREPARING`. A line becomes
`READY` only from `PREPARING`, the ticket becomes `READY` only when every line
is `READY`/`VOIDED`/`SERVED`, and only `READY` tickets serve.

`ORDER.status` and `KITCHEN_TICKET.status` are different fields on different entities.

## 4. Payment workflow (separate entity)

```text
PENDING → PROCESSING → PAID (PROCESSING → FAILED)
PAID → REFUND_PENDING → REFUNDED
```

Methods: cash, card, UPI, wallet, other. Split payments allowed (many payments per order). Never infer from order status.

## 5. Table workflow

```text
AVAILABLE → OCCUPIED → CLEANING → AVAILABLE
AVAILABLE → RESERVED → OCCUPIED
```

Also `OUT_OF_SERVICE`. Current `TableStatus` is now explicit: `available|occupied|reserved|cleaning|out_of_service`.

Occupancy is separate from table state. A table may contain multiple active `OccupancyGroup` records only when `allows_sharing=true`. The invariant is:

```text
sum(active_group.seats) <= table.capacity
```

The table's `occupancy_fill` is derived as `EMPTY`, `PARTIAL`, or `FULL`; it is not a replacement for the table state machine. Seating, adding guests, transfer, release, and cleaning transitions run through table-domain commands.

Deleting a floor or table with active occupancy is rejected. Layout changes (move, resize, rotate) do not mutate occupancy or historical snapshots.

Surface split (ADR-0004): the operations view (`/dashboard/tables`) is select-only —
seat, release (with reason; force-release when an order is open), transfer, block/unblock,
and mark-cleaned all run through table-domain commands. The settings Floor Plan Editor
is the only surface with drag/resize/rotate, the shape palette, undo, and add-table;
pose writes go through version-CAS `setTablePose`/`setFloorObjectPose` and never touch
occupancy.

## Order ↔ KOT linkage (ADR-0005)

Every add fires a new KOT (`addAndFireItem`: 1 order → N KOTs, each ticket
immutable once fired) — adds are allowed in any non-terminal order state, so
an order with fired KOTs simply grows another ticket; voids are deletion
records on the ticket with mandatory reason, never hard deletes. Bill
discounts are editable until COMPLETED/CANCELLED (paid/balance re-derive). Dine-in orders attach to occupancy via
`attachOrder`; releasing a party detaches its open order (settles independently). Detail pages fetch
client-side (localStorage-backed mocks — server prefetch would 404 new rows).

Reception capture (ADR-0006): `/dashboard/order-terminal` shows the operations
floor; tapping a table runs `ensureTableOrder` (live order or auto-created
CONFIRMED + seated + attached) and opens the product dialogue. Same-tab Clerk
session carries to other tabs automatically. Firing uses the same `fireKOT`;
voids stay in the order workspace.

Terminal gestures: single-press selects and slides the bill panel in (tap the
selected table or floor background to deselect and slide out); 500 ms
long-press jumps straight to item picking. The picker stays open for rapid
multi-add with a fire footer; added items fly to the KOT list (CSS FLIP, no
library). Occupancy independence (ADR-0014): releasing a party frees its seats
and returns the table to available at once — its order and KOTs stay open,
editable, and payable until payment + fulfillment complete them; detached bills
surface as open tabs. `ORDER_LOCKED` is history-only.

Shared-table parties (ADR-0013): a table with `allows_sharing` seats several
parties, each an `OccupancyGroup` with auto label (A, B, C…) and palette
colour, rendered as one chip per party on the canvas (tap = focus that party's
bill, never creates an order; 500 ms hold or Shift+Enter = `ensureGroupOrder`
and the picker opens for that party). One live order per party; add-ons fire
extra KOTs onto the same order. The bill panel shows a party strip to switch
parties and seat new ones; no state machine changes.

Item-wise returns (ADR-0016): served wrong/cold items return via `createReturn`
(SERVED/COMPLETED only, mandatory reason) — the qty voids off the KOT, wastes
via the cancelled-order path, leaves the bill pro-rata, and refunds to the
original payment methods (largest-first, per-payment caps; cash settles
instantly, gateway payments pend for the Razorpay phase). Returns are distinct
from pre-service voids and whole-order cancels.

## 6. Product workflow

```text
DRAFT → ACTIVE → INACTIVE
```

Inactive products stay out of new orders; history keeps referencing them (snapshots + soft-delete).

## 7. Product selection & combos

`Product → Variant? → Modifier Groups → Modifiers → Instructions → Order Item`. Combos are component groups with selectable options (e.g. Burger + Drink choices), not variants — never explode modifier combinations into variants.

## 8. Business events (audit trail)

`ORDER_CREATED, ORDER_CONFIRMED, ORDER_SENT_TO_KITCHEN, ORDER_UPDATED, ITEM_ADDED, ITEM_MODIFIED, ITEM_REMOVED, KITCHEN_TICKET_UPDATED, KITCHEN_STARTED, KITCHEN_ITEM_READY, ORDER_READY, ORDER_SERVED, KOT_VOIDED, KOT_LINE_VOIDED, PAYMENT_STARTED, PAYMENT_COMPLETED, PAYMENT_FAILED, REFUND_CREATED, ORDER_CANCELLED, ORDER_COMPLETED, WASTE_LOGGED, WASTE_FROM_ORDER_CANCELLED, FLOOR_CREATED, FLOOR_UPDATED, FLOOR_DELETED, FLOOR_REORDERED, TABLE_CREATED, TABLE_UPDATED, TABLE_MOVED, TABLE_RESIZED, TABLE_DELETED, TABLE_CLEANING_STARTED, OCCUPANCY_SEATED, OCCUPANCY_TRANSFERRED, OCCUPANCY_RELEASED, OCCUPANCY_CANCELLED, OCCUPANCY_ORDER_DETACHED, ORDER_CUSTOMER_LINKED, CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_DELETED, ORDER_DISCOUNTED, ORDER_SPLIT_BUILT, ORDER_SPLIT_EDITED, ORDER_SPLIT_CLEARED, ORDER_PAID, ORDER_LOCKED, KOT_LINE_QTY_ADDED, TABLE_STATUS_SET, PRINT_QUEUED, PRINT_SENT, PRINT_FAILED, BILL_REPRINTED, KOT_REPRINTED` — append-only, feeding audit, KDS, reports, integrations.

## 9. Wastage

Two sources, one log (`WasteLog`), direct-logged (no approval):

- **Manual** — expiry, spillage, spoilage, trimming, overproduction. Logged from Waste Log with material, qty, reason, optional photo evidence. Stock deducts immediately; `cost_loss = avg_cost × qty`.
- **Cancelled orders** — only kitchen-consumed (`PREPARING`+) lines waste ingredients. The orders module calls `recordWasteForCancelledOrder({ order_id, lines: [{ recipe_id, variant_id?, servings }] })`; quantities resolve per-variant overrides else base qty × servings (per ADR-0002); one log per ingredient with `reason: "order_cancelled"`, ledger `reference_id` = order. Pre-kitchen lines waste nothing.
