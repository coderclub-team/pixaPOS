# ADR-0001: Money, events, and rollout order for workflow adoption

Date: 2026-09-10 · Status: accepted

## Context

The RMS guide demands integer minor units, explicit state machines, snapshots, and an audit trail. The repo today uses float rupees + `Math.round(x*100)/100` (~50 sites), direct stock writes with paired ledger pushes, no event trail, no order/kitchen/payment modules, no tests or `docs/`.

## Decisions

1. **Paise for new modules.** Orders/payments store integer paise. Inventory/menu floats stay; a `money.ts` util (`toPaise/fromPaise/formatINR`) converts at boundaries. A repo-wide money migration is deferred as too invasive.
2. **Foundations → orders → kitchen → payments → parity hardening.** Shared primitives (event log, transition helper, money util, docs, vitest) land before the first state machine.
3. **Wrap, don't rewrite, inventory.** `InventoryService.recordX` wrappers own mutation + ledger + events; internals and float convention unchanged.

## Consequences

- New code must use paise and go through transition commands + events.
- Inventory wrappers must preserve existing totals/rounding behavior; add tests pinning current math before wrapping.
