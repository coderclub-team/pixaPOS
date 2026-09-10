# AGENTS.md — pixaPOS Agent Reference

Restaurant POS: menu catalog, variants, modifiers, orders, kitchen, payments, inventory, outlet, tables, customers, reports. Workflows: dine-in, takeaway, delivery, counter, split payments, modification, cancellation, refunds.

This file is auto-loaded (see `opencode.json` → `instructions`). Sub-agents: `planner` (plans + ADRs, read-only), `debater` (critiques architecture), `security_analyst` (privacy/vuln/auth review).

## 1. Project map

- `apps/web` — Next.js 16 App Router, React 19, TS strict, Tailwind v4, Base UI + shadcn-style `Card Input Select Switch Popover Command Table Dialog DropdownMenu`.
- `apps/web/features/<domain>/api/{types.ts,service.ts,queries.ts}` — **the** data layer. Components import types from `types.ts`, functions from `service.ts`, query options from `queries.ts`. `service.ts` is the only file swapped for a real backend (mock by default). Never import mock constants directly in components.
- `apps/web/features/<domain>/{components,schemas}` + `apps/web/app/dashboard/<domain>/**` routes + `packages/ui/config/nav-config.ts` (RBAC groups).
- `packages/ui` — shared primitives (`base-ui/*`, `Icons` registry, `cn()`). Never import tabler icons directly; use `Icons.key`.
- Forms: `useAppForm` + `form.AppField` shared fields; `PageContainer` props for headers (never manual `<Heading>`); `Button isLoading` for pending.
- Tables: `DropdownMenu modal=false`, ghost `h-8 w-8 p-0` vertical-ellipsis trigger, `Actions` group (Update/Edit + Delete), `Dialog` confirm — never inline `confirm()`.
- Money today: float rupees + `Math.round(x*100)/100`. **New order/payment code stores integer paise**; convert at inventory/menu boundaries (`toPaise/fromPaise`, see ADR-0001).

## 2. Reference apps (non-negotiable)

Before planning any feature, inspect **Odoo, Zoho, Petpooja, TMBill**: compare flows/models/UI, list gaps vs pixaPOS, base `plan.md` on the parity analysis (see root `plan.md`).

## 3. Domain rules

- **Modules** (`catalog, orders, kitchen, payments, inventory, tables, customers, reporting`) own their rules in `service.ts`. No business logic in UI, no direct DB/state mutation from components, no duplicate abstractions.
- **Products**: `SIMPLE | VARIANT | COMBO`. Modifiers/add-ons are separate from variants — never model modifier combinations as variants.
- **States are explicit enums + transition maps** (`docs/workflows.md`). Never `order.status = "IN_KITCHEN"` from arbitrary code; use `OrderService.sendToKitchen(orderId)`-style commands that validate, transition, side-effect, and audit.
- **Snapshots**: order items store sale-time snapshots (`product/variant_name_snapshot`, paise amounts). Catalog changes must never mutate history.
- **IDs**: stable `*_id` strings everywhere; soft-delete (`deleted_at`) for entities referenced by history; never display names as identifiers.
- **Kitchen ≠ order state; payment ≠ order state.** Separate entities, separate machines.
- **Inventory moves only via transactions** (`SALE PURCHASE ADJUSTMENT WASTE RETURN TRANSFER`), wrapped in `InventoryService.recordX` owning mutation + ledger + events.
- **Audit**: every important transition emits a business event (`ORDER_CREATED … REFUND_CREATED`, full list in `docs/workflows.md`).

## 4. Safety

No prod-data deletes, no gratuitous schema changes, no silent financial/behavioral changes, no public-API renames without checking consumers. When unsure, inspect workflow docs first. Document new workflows (states, transitions, side effects) and test important transitions.

## 5. Docs

- `docs/workflows.md` — lifecycle state machines (source of truth for transitions).
- `docs/adr/` — Architecture Decision Records; planner writes one per significant decision.
- `plan.md` — persistent reference-apps rule.
