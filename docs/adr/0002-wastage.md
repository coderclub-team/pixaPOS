# ADR-0002: Wastage management

Date: 2026-09-10 · Status: accepted

## Context

Spoilage, expiry, and accidental spills need immediate logging. Cancelled ready orders waste already-prepared ingredients. Odoo models this as scrap orders (product + qty + source → scrap location + reason + source document); the repo has `WasteLog` + `waste`-type ledger entries but no order link, no recipe path in UI, and no `consumeRecipe` on sale.

## Decisions

1. **Direct log, no approval.** Staff log waste immediately (matches current `createWasteLog`); approval workflow deferred.
2. **Only kitchen-consumed lines waste on cancel.** The future orders module passes only `PREPARING`+ lines to `recordWasteForCancelledOrder`; pre-kitchen lines waste nothing. Enforced by contract at the caller.
3. **Per-variant resolution.** Cancelled-line quantities use `variant_qtys` override, else base qty × servings; aggregated per material so stock deducts once; ledger `reference_id` carries the order id.
4. **Reasons extended, not replaced.** `order_cancelled` added to `WasteReason`; existing reasons unchanged. `cost_loss` stays float rupees (ADR-0001 paise rule covers new order/payment code only).
5. **Waste logs immutable.** List offers View only (Odoo validates rather than deletes); corrections go through new offsetting logs.

## Consequences

- `recordWasteForCancelledOrder` is the integration contract for the orders module; its input shape (`CancelledOrderWasteInput`) is stable API.
- Events `WASTE_LOGGED` / `WASTE_FROM_ORDER_CANCELLED` join the trail in `docs/workflows.md` §8 (payloads forward-compatible with the events module).
