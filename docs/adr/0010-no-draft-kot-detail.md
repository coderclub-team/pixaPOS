# ADR-0010: Draft retired — orders start CONFIRMED, KOT-based detail page

Date: 2026-09-12 · Status: accepted

## Context

Order-taking had a draft stage (DRAFT order, draft lines, Fire button) that
no longer matches operations: every add fires a KOT immediately in the
terminal, and the detail page duplicated the terminal bill panel. The orders
list carried draft hints and a Confirm action; the detail page duplicated
draft editing that the service now rejects for fired lines.

## Decisions

1. **Orders are created CONFIRMED** (`ORDER_CREATED` + `ORDER_CONFIRMED` at
   creation). DRAFT remains in the status union and transition map for stored
   history only — no UI creates, shows, or confirms it. `confirmOrder` is an
   idempotent no-op for CONFIRMED.
2. **Adds always fire.** `addAndFireItem` is the single add path (simplified —
   no confirm step). `addOrderItem`/`setDiscount` accept CONFIRMED only.
   Delete allowed iff zero fired lines, any status; fired orders use Cancel.
3. **Detail page is KOT-based**: order-info card, one card per KOT with
   counter-input rows (+/−/trash wired to increase/void with reason), whole-KOT
   void, read-only bill card (checkout stays in the terminal). No canvas —
   tables/forms/dialogs house style.
4. **Add-item dialog** (`KotItemDialog`): searchable row list, per-row qty
   counters, inline variant/modifier/instruction config, Fire footer creating
   one KOT per pick. The terminal keeps `ItemPicker` this branch; migration to
   the shared dialog (and `ItemPicker` deletion) is a follow-up.
5. **Docs**: workflows order lifecycle notes DRAFT as retired; KOT-linkage
   section describes add-and-fire.

## Consequences

- Service draft helpers (`updateDraftItemQty`, `removeDraftItem`,
  `markLinesFired`, `fireKOT`) stay for the terminal/workspace paths that
  still compose them; UI no longer surfaces drafts.
- Discount-before-fire now means CONFIRMED-status guard (documented in code).
