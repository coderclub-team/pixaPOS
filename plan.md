# pixaPOS Feature Discovery Template

Use this document before planning a product, workflow, data-model, navigation,
or operational UI change. It prevents feature parity from becoming feature copy.

## Required discovery

1. Inspect the current domain's `types.ts`, `service.ts`, `queries.ts`, routes,
   components, workflow entries, and related ADRs.
2. Compare the flow with Odoo, Zoho, Petpooja, TMBill, and Rista. Prefer primary
   documentation; record links and the access date.
3. Create a short parity table: competitor capability, pixaPOS status, user value,
   and deliberate deferment or gap.
4. Identify state transitions, audit events, snapshots, paise boundaries,
   authorization, accessibility, touch operation, offline/outbox behavior, and
   recovery messaging affected by the change.
5. Ask only decisions that change user-facing policy, workflow rules, or a public
   contract. Record accepted defaults in the plan or ADR.

## Minimum feature plan

```md
## Goal and users
## Current behavior and parity comparison
| Capability | Odoo | Zoho | Petpooja | TMBill | Rista | pixaPOS decision |
## Proposed workflow and safeguards
## UI states: loading, empty, error, offline, permission denied
## Contract and data impact
## Validation and acceptance criteria
## Open decisions / accepted assumptions
```

## Product benchmark

The initial operational baseline includes table/floor operations, fast order
capture, KOT/KDS status handling, split and multi-tender payments, modifiers,
inventory movement, customer records, and audit trails. Odoo additionally
documents restaurant floor plans, order transfer/merge, preparation displays,
course firing, and self-ordering; treat these as benchmark capabilities, not a
directive to copy its UI.

- [Odoo restaurant POS](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/restaurant.html)
- [Odoo preparation display](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/preparation.html)
- [Odoo self-ordering](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/self_order.html)
- [Zoho Inventory](https://www.zoho.com/inventory/help/)
- [Petpooja restaurant POS](https://www.petpooja.com/)
- [TMBill restaurant POS](https://tmbill.com/)
- [Rista restaurant POS](https://www.ristaapps.com/)

## pixaPOS differentiators

Prioritise fewer, faster operational workflows over broad but shallow parity:
local-first POS/KDS, clear sync/recovery status, auditable commands, role-aware
exceptions, accessible touch-first screens, and a consistent design system across
web and mobile. Do not place competitor names or copied terminology in product UI.
