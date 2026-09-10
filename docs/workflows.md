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

Also `OUT_OF_SERVICE`. Current `TableStatus` (`available|occupied|reserved|maintenance`) still needs `CLEANING` (Phase 4).

## 6. Product workflow

```text
DRAFT → ACTIVE → INACTIVE
```

Inactive products stay out of new orders; history keeps referencing them (snapshots + soft-delete).

## 7. Product selection & combos

`Product → Variant? → Modifier Groups → Modifiers → Instructions → Order Item`. Combos are component groups with selectable options (e.g. Burger + Drink choices), not variants — never explode modifier combinations into variants.

## 8. Business events (audit trail)

`ORDER_CREATED, ORDER_CONFIRMED, ORDER_SENT_TO_KITCHEN, ITEM_ADDED, ITEM_MODIFIED, ITEM_REMOVED, KITCHEN_STARTED, KITCHEN_ITEM_READY, ORDER_READY, ORDER_SERVED, PAYMENT_STARTED, PAYMENT_COMPLETED, PAYMENT_FAILED, REFUND_CREATED, ORDER_CANCELLED, ORDER_COMPLETED` — append-only, feeding audit, KDS, reports, integrations.
