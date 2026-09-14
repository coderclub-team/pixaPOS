# pixaPOS Engineering Guide

pixaPOS is a local-first restaurant operations platform: POS, KOT/KDS, payments,
inventory, tables, customers, reporting, and multi-outlet administration.

## Workspace ownership

- `apps/web` is the current POS and back-office reference implementation.
- `apps/admin` will own organisation and multi-outlet administration.
- `apps/mobile` will serve staff workflows; do not copy web components into it.
- `apps/template` is a reusable starter/reference, not a production source of truth.
- `packages/ui` owns reusable design tokens and platform primitives. Web uses
  Base UI/shadcn-style components; native uses matching native adapters.
- Future packages: `@pixa/contracts` owns domain command/query contracts and
  `@pixa/api-client` owns transport and query adapters. Apps own routes and
  screen composition, never another app's feature code.

## Domain boundaries

Each domain owns its rules in `features/<domain>/api/service.ts`; UI calls
commands and never mutates stores directly. Keep public types in `types.ts` and
React Query options in `queries.ts`. Products are `SIMPLE | VARIANT | COMBO`;
modifiers are separate from variants. Use stable `*_id` values, soft-delete
history-referenced records, and sale-time snapshots.

Order, kitchen, payment, and table status are separate state machines. Only
service commands may transition them, validate guards, perform side effects, and
append business events. New order/payment amounts use integer paise; convert at
legacy menu/inventory boundaries. `docs/workflows.md` is the source of truth.

## UI and accessibility

Use existing `@pixa/ui` primitives before custom markup. Prefer semantic tokens,
component variants, `gap-*`, `cn()`, and the `Icons` registry. Dialogs, Sheets,
and Drawers require titles; destructive actions require a confirmation dialog.
Forms use `useAppForm` and shared fields. Tables use the shared three-dot action
pattern. Design for keyboard, screen reader, touch, loading, empty, error, and
offline states.

## Local-first operations

POS and KDS commands must remain auditable while disconnected. Future work uses
durable local state, an idempotent outbox, explicit sync status, and visible
conflict/recovery handling. Never silently discard a financial or kitchen action.
See `docs/offline-and-sync.md`.

## Planning and validation

Before a feature, compare Odoo, Zoho, Petpooja, TMBill, and Rista using
`plan.md`; capture the pixaPOS gap and workflow impact. Write an ADR for a
significant cross-app, persistence, workflow, or public-contract decision.

Run `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` before handoff. Do
not modify copied vendor skills under `apps/template/.agents` or `.claude`;
their upstream guidance is not pixaPOS policy.
