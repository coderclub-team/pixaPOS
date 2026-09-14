# ADR-0012: Editable bill splits with ledger guards

Date: 2026-09-14 · Status: accepted · Amends ADR-0008 §4

## Context

Splits were create-once in UI (`SplitSection` builders gated on `!order.split`)
while the service silently overwrote on every `computeSplits` call, with no
remove path and no audit trail beyond a repeated `ORDER_SPLIT_BUILT`. The order
detail route also rendered billing as one monolith card instead of the uniform
stacked panels used by purchase/customer pages.

## Decisions

1. **Guarded rebuild, not free overwrite.** `computeSplits` over an existing
   split is allowed in any non-terminal state, but a share can never shrink
   below its already-paid amount (payments are immutable, ADR-0008 §1) and a
   label carrying payments can never be renamed or dropped
   (`partition_label` has no FK). Rebuilds emit `ORDER_SPLIT_EDITED`.
2. **Explicit audited removal.** New `clearSplit` command (reason mandatory):
   blocked on terminal orders and whenever any `PAID` payment carries a share
   label. Emits `ORDER_SPLIT_CLEARED`. `setDiscount` keeps wiping the split
   (ADR-0008 behavior unchanged).
3. **No occupancy guard on splits.** Splits partition payment, and payments
   stay open when release-locked (`docs/workflows.md` §5 + release-locks-order
   rule). Terminal (`COMPLETED`/`CANCELLED`) block only.
4. **Detail route layout:** stacked `max-w-4xl` panels — compact Order Details
   strip (facts + customer + seating) on top, then Bill (KOTs + totals),
   Split Bill (edit/remove), Payments (tender + ledger + refunds), Danger
   zone. Terminal keeps the single-column `OrderBillPanel` flow unchanged.

## Consequences

- New audit events `ORDER_SPLIT_EDITED/CLEARED` (see `docs/workflows.md` §8).
- Stale splits possible when adds/voids/discounts move `grand` after a split;
  UI shows a rebuild hint instead of auto-rebuilding (auto-rebuild could
  violate paid guards).
