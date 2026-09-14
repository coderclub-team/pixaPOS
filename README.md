# pixaPOS

pixaPOS is a Turborepo workspace for intuitive, resilient restaurant operations:
POS order capture, KOT/KDS, tables, payments, inventory, customers, and reporting.
The product target is a local-first POS and KDS that keeps staff productive during
temporary connectivity loss while preserving an auditable operational history.

## Workspace

| Path | Responsibility |
| --- | --- |
| `apps/web` | Current Next.js POS and back-office reference app |
| `apps/admin` | Future multi-outlet administration app |
| `apps/mobile` | Expo staff companion workflows |
| `apps/template` | Reusable dashboard starter; not production source code |
| `packages/ui` | Shared design tokens and web/native UI primitives |
| `packages/types` | Existing shared types; contracts move here only as an interim step |
| `docs` | Product workflows, architecture, ADRs, and delivery roadmap |

## Start development

```bash
pnpm install
pnpm dev:web       # Next.js POS at http://localhost:3000
pnpm dev:admin     # Next.js admin app
pnpm dev:mobile    # Expo development server
pnpm dev:template  # Template at http://localhost:3001
```

## Validate changes

```bash
pnpm format:check  # Check formatting
pnpm lint          # Run workspace lint tasks
pnpm typecheck     # Run workspace type checks
pnpm build         # Build all apps through Turbo
```

Use `pnpm --filter @pixa/web <script>` to run an app-specific script. The root
workspace uses pnpm and Turbo; do not substitute npm, bun, or yarn.

## Architecture principles

- Apps compose screens; shared packages provide platform primitives and contracts.
- Each domain owns its commands, invariants, and events. Components never perform
  direct business-state mutations.
- Orders, kitchen tickets, payments, inventory, and tables retain independent,
  explicit state machines. Historical sales use snapshots and soft deletion.
- New order/payment money values are integer paise. Existing inventory/menu
  boundaries convert deliberately.
- UI uses reusable shadcn-style/Base UI primitives, semantic tokens, accessible
  interactions, and touch-friendly POS layouts.

Read [the engineering guide](AGENTS.md), [architecture](docs/architecture.md),
[design system](docs/design-system.md), [offline model](docs/offline-and-sync.md),
[workflows](docs/workflows.md), and [roadmap](docs/roadmap.md) before extending a
domain.
