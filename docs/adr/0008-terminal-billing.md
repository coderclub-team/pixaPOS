# ADR-0008: Terminal billing — bill panel, payments, splits

Date: 2026-09-11 · Status: accepted

## Context

The order terminal captured items but had no billing surface: no discount, no
tender methods, no paid marking, no splits — while reference parity (Odoo
register + bill split, Zoho multi-tender, Petpooja equal/item-wise/custom
splits + discounts, Rista partial payments) demands all of them. The panel is
the Bill, never a "cart".

## Decisions

1. **Payments are immutable records** (`pay_*`, paise). Non-cash methods match
   the balance exactly; cash may over-tender with change due (change is never
   revenue). Refunds are record-only against a payment, capped at its amount.
2. **Order lifecycle untouched.** Paid-ness is `payment_status`
   (UNPAID/PARTIAL/PAID) derived from the ledger — orthogonal like kitchen
   state. Post-paid edits (new items, new KOTs) reopen the balance; payments
   are never rewritten. Voids after paid require refund-first (guard error).
3. **Bill discount pre-tax, single active discount.** Percent or flat paise
   with mandatory reason, DRAFT/CONFIRMED only; tax recomputed pro-rata on the
   discounted base. `total_paise` stays pre-discount for history; the bill
   shows both plus `grand_total_paise`.
4. **Splits are partitions of one bill** (no hard sub-orders v1): equal
   (residue to last share), item-wise (must cover every line; bill discount
   folded into last share), custom (must sum to grand total). Partitions pay
   independently via multi-tender; firing stays independent of splits.
5. **Terminal layout:** right rail replaced by `OrderBillPanel` (draft lines,
   collapsed KOT accordion with kitchen line-status dots, bill, splits, tender
   pad, payment history). KOT voids stay in the order workspace — the panel is
   read-only for fired tickets. Selected table gets a thick primary ring +
   tinted halo plus a "Taking order — Tn" badge.
6. **Backfill:** orders stored before billing normalize on load
   (`grand_total_paise`, `payment_status`).

## Consequences

- Phase-2 payments scope is now delivered inside the terminal; the workspace
  bill summary can later embed the same panel.
- New audit events: `ORDER_DISCOUNTED/SPLIT_BUILT/PAID`,
  `PAYMENT_STARTED/COMPLETED/FAILED`, `REFUND_CREATED`.
