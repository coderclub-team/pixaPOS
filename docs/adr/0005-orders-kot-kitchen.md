# ADR-0005: Orders, KOTs, and kitchen board (Phase 1)

Date: 2026-09-11 · Status: accepted

## Context

Tables and occupancy exist but no order entity. Reference parity (Odoo POS
Restaurant, Zoho POS, Petpooja POSS, Rista) requires: channel-aware orders,
draft → fired kitchen tickets (1 order → N KOTs), void-with-reason recorded on
the ticket, a kitchen display board, and multi-tender/split payments.
No competitor names appear in the UI.

## Decisions

1. **Two route surfaces.** `/orders` workspace (create → add items → fire KOTs →
   bill summary) plus `/kitchen` KDS board. No standalone `/kot` page — KOTs are
   sections inside the order workspace, one card per fired ticket.
2. **Separate add-items page** (`/orders/[orderId]/add`): searchable menu grid
   (first-50 slice + refine hint, house combobox rule), category rail, variant /
   add-on / instruction dialog, qty stepper. Touch/POS speed beats an inline dialog.
3. **Draft KOT is virtual.** Unfired order lines are the draft; `fireKOT` freezes
   them into an immutable ticket and the next added item starts a new draft.
4. **Voids are deletion records, never deletes.** `voidKOT` / `voidKOTLine`
   (partial qty allowed) require a reason via Dialog, append `KOTVoidRecord`s
   shown red-marked, and route kitchen-consumed (`PREPARING`+) lines through the
   existing `recordWasteForCancelledOrder` contract.
5. **Money in paise** (ADR-0001): `lib/money.ts` (`toPaise/fromPaise/formatINR`)
   converts the menu/inventory float boundary once at `addOrderItem`; all order
   math is integer. Item-level GST snapshots per line; discounts deferred.
6. **KDS-only v1.** No thermal printing; print is stubbed for later. Aggregator
   orders are manual punch-in with `external_ref`. Merge-tables deferred.
7. **Occupancy wiring reuses table commands.** Dine-in orders attach via the
   existing `attachOrder`; the unpaid-order guard on release already protects
   open orders. No new table transitions.
8. **No server prefetch on detail pages.** Order/KOT stores are
   localStorage-backed mocks — prefetched `null` would hydrate and 404 new rows
   (same root cause as the table/floor fix). Client fetches in Suspense.

## Consequences

- Phase 2 (customers, payments, equal/item-wise/custom splits + multi-tender)
  builds on the paise totals engine and the `COMPLETED`-requires-paid rule.
- New audit events: `ITEM_ADDED/MODIFIED/REMOVED`, `KITCHEN_STARTED`,
  `KITCHEN_ITEM_READY`, `ORDER_READY/SERVED`, `KOT_VOIDED/LINE_VOIDED`.
