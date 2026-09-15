# ADR-0016: Item-wise order returns with same-method refunds

Date: 2026-09-16 · Status: accepted

## Context

Voids cover pre-service corrections; cancellations kill whole orders. Neither
handles the real post-sale flow: a served wrong/cold dish comes back, the bill
must shrink, and money must go back the way it came (Zoho pattern: gateway
payments auto-refund to source, cash/manual recorded in the books; Razorpay:
source-only refunds, full or multiple partials, normal vs instant, webhook
final status).

## Decisions

1. **Return ≠ void ≠ cancel.** `createReturn` (SERVED/COMPLETED orders only,
   reason mandatory) voids the qty off the KOT via `returnKOTLine` (works on
   served lines, records on the ticket, wastes the food — never restocked),
   excludes it from bill totals pro-rata, and refunds to original methods.
2. **Bill shrinks, no phantom due.** `recomputeTotals` excludes `returned_qty`
   pro-rata (subtotal, tax, grand re-derive). Paid/balance follow automatically.
3. **Same-method allocation, largest-first**, each capped by the payment's
   unrefunded remainder (pending reservations count, so no double-allocate).
   Cash/manual settle instantly as `REFUNDED`; gateway-flagged payments land as
   `REFUND_PENDING` with `gateway_payment_id/status` slots reserved — visible,
   never silent.
4. **Gateway handoff ready.** `Refund` carries `gateway_payment_id`,
   `gateway_refund_id`, `gateway_status`, item linkage (`order_line_id`, `qty`,
   `return_id`), and `REFUND_FAILED` exists. Phase 2 plugs Razorpay order
   collection (capture payment id at tender) + `POST /payments/:id/refund` +
   `refund.processed` webhook reconcile without touching return semantics.
5. **Events**: `KOT_LINE_RETURNED` (kitchen truth) + `ITEM_RETURNED` (bill +
   refund summary) join the audit trail; timeline renders both.

## Consequences

- Returns need a served bill; unfired lines keep the edit/void path.
- Discount-then-return math stays pro-rata on the discounted base (existing
   `recomputeTotals` order of operations preserved).
- Post-return balance can go negative-paid (overpayment) — collected via the
  normal refund path, same as discount overpayment today.
