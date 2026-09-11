# Restaurant Workflows

Source of truth for lifecycle state machines. Code and these docs must stay consistent (guide §16). Transitions run only through domain-service commands that validate, side-effect, and emit business events.

## 1. Order lifecycle

```text
DRAFT → CONFIRMED → IN_KITCHEN → PREPARING → READY → SERVED → COMPLETED
```

Cancellation: `DRAFT → CANCELLED`, `CONFIRMED → CANCELLED`, `IN_KITCHEN → CANCELLED`. Past `PREPARING`, cancellation needs authorization and records who/when/reason/previous-state/financial + inventory impact.

- **DRAFT**: building — add/remove items, variants, modifiers, table, customer, instructions, permitted discounts. No kitchen ticket.
- **CONFIRMED**: cashier/server confirmed — print receipt, send to kitchen, accept payment, policy-bound modify/cancel.
- **IN_KITCHEN**: ticket created; kitchen may begin. **PREPARING**: kitchen started (item-ready marks allowed; cancel needs auth). **READY**: awaiting pickup/serve/delivery. **SERVED** (dine-in). **COMPLETED**: normally `payment = PAID` + fulfillment done.

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

Unfired order lines are the virtual draft KOT. `fireKOT` freezes them into an
immutable ticket (1 order → N KOTs); voids are deletion records on the ticket
with mandatory reason, never hard deletes. Dine-in orders attach to occupancy
via `attachOrder`; release guards protect open orders. Detail pages fetch
client-side (localStorage-backed mocks — server prefetch would 404 new rows).

Reception capture (ADR-0006): `/dashboard/order-terminal` shows the operations
floor; tapping a table runs `ensureTableOrder` (live order or auto-created
DRAFT + seated + attached) and opens the product dialogue. Same-tab Clerk
session carries to other tabs automatically. Firing uses the same `fireKOT`;
voids stay in the order workspace.

## 6. Product workflow

```text
DRAFT → ACTIVE → INACTIVE
```

Inactive products stay out of new orders; history keeps referencing them (snapshots + soft-delete).

## 7. Product selection & combos

`Product → Variant? → Modifier Groups → Modifiers → Instructions → Order Item`. Combos are component groups with selectable options (e.g. Burger + Drink choices), not variants — never explode modifier combinations into variants.

## 8. Business events (audit trail)

`ORDER_CREATED, ORDER_CONFIRMED, ORDER_SENT_TO_KITCHEN, ITEM_ADDED, ITEM_MODIFIED, ITEM_REMOVED, KITCHEN_TICKET_UPDATED, KITCHEN_STARTED, KITCHEN_ITEM_READY, ORDER_READY, ORDER_SERVED, KOT_VOIDED, KOT_LINE_VOIDED, PAYMENT_STARTED, PAYMENT_COMPLETED, PAYMENT_FAILED, REFUND_CREATED, ORDER_CANCELLED, ORDER_COMPLETED, WASTE_LOGGED, WASTE_FROM_ORDER_CANCELLED, FLOOR_CREATED, FLOOR_UPDATED, FLOOR_DELETED, FLOOR_REORDERED, TABLE_CREATED, TABLE_UPDATED, TABLE_MOVED, TABLE_RESIZED, TABLE_DELETED, TABLE_CLEANING_STARTED, OCCUPANCY_SEATED, OCCUPANCY_TRANSFERRED, OCCUPANCY_RELEASED, OCCUPANCY_CANCELLED, OCCUPANCY_ORDER_DETACHED` — append-only, feeding audit, KDS, reports, integrations.

## 9. Wastage

Two sources, one log (`WasteLog`), direct-logged (no approval):

- **Manual** — expiry, spillage, spoilage, trimming, overproduction. Logged from Waste Log with material, qty, reason, optional photo evidence. Stock deducts immediately; `cost_loss = avg_cost × qty`.
- **Cancelled orders** — only kitchen-consumed (`PREPARING`+) lines waste ingredients. The orders module calls `recordWasteForCancelledOrder({ order_id, lines: [{ recipe_id, variant_id?, servings }] })`; quantities resolve per-variant overrides else base qty × servings (per ADR-0002); one log per ingredient with `reason: "order_cancelled"`, ledger `reference_id` = order. Pre-kitchen lines waste nothing.
