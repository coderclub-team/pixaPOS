# Architecture

## Target shape

pixaPOS is a pnpm/Turborepo workspace. Apps own their routes, providers, and
screen composition; packages own reusable platform concerns. Dependencies point
from apps to packages, never from a package to an app or between app features.

```text
apps/{web,admin,mobile}
        ↓
packages/{ui,contracts,api-client}
        ↓
backend adapters and durable local storage
```

`apps/web` is the current operational reference. `apps/admin` and `apps/mobile`
remain intentionally thin until their user workflows are selected. `apps/template`
is a starter and comparison source; improvements become shared only after being
extracted deliberately into a package.

## Package boundaries

- `@pixa/ui`: tokens, primitive components, shared patterns, and web/native
  adapters. It contains no restaurant business rules or API calls.
- `@pixa/contracts` (planned): stable domain entities, command inputs/results,
  query filters/results, error codes, and event envelopes. It contains no React,
  storage, or transport code.
- `@pixa/api-client` (planned): authenticated transport, serialization,
  idempotency headers, query adapters, and error normalization.

Do not create these packages until the first cross-app consumer exists. Until
then, preserve each web feature's `api/types.ts → service.ts → queries.ts`
boundary so extraction is mechanical rather than a rewrite.

## Domain commands

Each module owns commands such as `OrderService.addAndFireItem` or
`InventoryService.recordWaste`. A command validates permissions and transitions,
persists its mutation, emits an append-only event, and returns a typed result.
Commands never rely on a component's local state as their source of truth.

Order, KOT/KDS, payment, table, and inventory lifecycles remain independent.
History uses immutable sale-time snapshots; records referenced by history are
soft-deleted. `docs/workflows.md` and accepted ADRs are authoritative.

## Delivery rules

Select backend framework, database, and hosting only when a contract requires a
durable implementation. Every new public contract needs compatibility notes,
idempotency expectations for commands, and tests covering transition guards.
