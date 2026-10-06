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
- Multi-tenant rule: Workspace = business/billing boundary, Outlet =
  operational boundary (`docs/architecture/multi-workspace-multi-outlet.md`).
  Never create a workspace per outlet; outlet rows carry `outlet_id` today and
  gain explicit `workspace_id` with the second outlet.

## Subdomain map

| Subdomain                     | Application                      | Primary user                  |
| ----------------------------- | -------------------------------- | ----------------------------- |
| `www.pixapos.store`           | Public pixaPOS website           | Everyone                      |
| `admin.pixapos.store`         | SaaS administration              | pixaPOS team                  |
| `app.pixapos.store`           | Restaurant management            | Owner / Manager               |
| `captain.pixapos.store`       | Captain / Steward ordering       | Captain / Waiter              |
| `kds.pixapos.store`           | Kitchen Display System           | Kitchen staff                 |
| `kiosk.pixapos.store`         | Self-ordering kiosk              | Customers                     |
| `order.pixapos.store`         | Online ordering                  | Customers                     |
| `kot.pixapos.store`           | KOT-focused interface            | Restaurant staff / production |
| `www.<restaurant-domain>`     | Restaurant's public website      | Customers                     |

- `kot.pixapos.store` is provisional — build only when the KOT-interface need is confirmed.
- Session/auth must span `*.pixapos.store` (shared cookie domain) across Clerk and Better Auth.
- Each subdomain is a separate deploy surface (Vercel project or rewrite) serving its mapped app; `www.<restaurant-domain>` is per-tenant custom-domain territory, not platform surface.

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

## Order modes (table vs counter)

- `outlet_type` never decides ordering behavior. Order mode does:
  `table | counter` now, extensible to `takeaway | delivery | online | kiosk`.
- Outlet config owns availability: `table_orders_enabled`,
  `counter_orders_enabled`, `default_order_mode` (defaults per outlet type,
  owner-overridable). Terminal entry follows config: tables-only, products-only,
  or a lightweight mode selector — never force counter flow through floors.
- Counter orders are first-class: `table_id`/`occupancy_group_id` nullable, no
  fake tables, same `createOrder` → items → KOT → KDS → payment → completion
  pipeline. KOT derives from the order, never the table; KDS shows COUNTER
  (never "Table —") for table-free tickets; surface `TABLE 12 | COUNTER |
  TAKEAWAY | DELIVERY` labels, never internal enums or outlet-type names.
- Payment timing is per-mode configurable (`before_kot | after_kot |
  at_completion`); table defaults to after/at-completion, counter to
  before/at-completion. Never assume KOT → Bill → Payment order.

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
