---
name: swiggy-pos-integration
description: Implement and maintain Swiggy integrations for pixaPOS. Use this skill whenever working on Swiggy restaurant integrations, delivery-platform connectivity, menu/order synchronization, partner onboarding, webhooks, authentication, outlet mapping, order lifecycle, or Swiggy API/MCP integration. Always verify current Swiggy documentation before using an endpoint, tool, parameter, authentication flow, or capability.
---

# Swiggy POS Integration Skill for pixaPOS

## Purpose

Build a production-ready Swiggy integration for pixaPOS without confusing:

1. Swiggy's public Food/Builders Club APIs and MCP platform, which expose consumer-side food discovery, menu browsing, cart, ordering and tracking capabilities.
2. A restaurant/POS partner integration, where Swiggy sends restaurant orders to a POS and the POS synchronizes menu, availability and order lifecycle.

These are different integration surfaces. Do NOT assume that the public Swiggy Food MCP API is the restaurant POS integration API.

## Source of truth

Before implementing or changing Swiggy-specific code, consult the current official Swiggy documentation:

- Swiggy Developer Portal:
  https://developers.swiggy.com/
- Swiggy Builders Club:
  https://mcp.swiggy.com/builders/
- Builders Club documentation index:
  https://mcp.swiggy.com/builders/llms.txt
- Full Builders Club documentation:
  https://mcp.swiggy.com/builders/llms-full.txt
- Food API/MCP reference:
  https://mcp.swiggy.com/builders/docs/reference/food/
- Authentication:
  https://mcp.swiggy.com/builders/docs/start/authenticate/
- Enterprise / integration program:
  https://mcp.swiggy.com/builders/enterprises/

Rules:
- Never invent Swiggy endpoint names or payload fields.
- Never assume a Food MCP operation is a restaurant-POS operation.
- If the required restaurant partner API is not publicly documented, treat its exact contract as unavailable and isolate it behind an adapter/provider interface.
- Prefer official Swiggy documentation over blogs, GitHub examples, or third-party reverse engineering.
- Record the documentation URL and retrieval date in implementation notes when an integration contract changes.

## pixaPOS architecture

Use a provider adapter so Swiggy is not coupled to the POS domain model.

Recommended structure:

src/
  integrations/
    swiggy/
      client.ts
      auth.ts
      adapter.ts
      mapper.ts
      webhooks.ts
      errors.ts
      types.ts
      sync.ts
    zomato/
      ...
  domain/
    orders/
    menu/
    inventory/
    outlets/
    integrations/

The POS domain owns canonical data.

Swiggy is an external sales channel.

Canonical flow:

Swiggy -> Integration Adapter -> Normalized External Order -> pixaPOS Order -> KOT/KDS

and:

pixaPOS Menu/Availability -> Integration Adapter -> Swiggy

Do not make Swiggy-specific fields the primary fields in the restaurant order schema.

## Integration entities

Keep integration data separate from core restaurant entities.

Recommended concepts:

- integration_accounts
- integration_outlets
- integration_menu_mappings
- integration_item_mappings
- integration_order_mappings
- integration_events
- integration_sync_jobs
- integration_credentials / secret references

An integration outlet should map:

workspaceId
restaurantId
outletId
provider
externalOutletId
status
lastSyncAt
metadata

An order mapping should preserve:

workspaceId
internalOrderId
provider
externalOrderId
externalOrderStatus
lastProviderEventId
lastSyncedAt
metadata

## Multi-tenant security

pixaPOS is SaaS.

Never store provider credentials in client-side code, localStorage, public environment variables, or browser-accessible configuration.

Use server-side secrets.

Every integration request must be scoped to:

workspace -> restaurant -> outlet -> provider account

Never trust workspaceId, outletId, or restaurantId supplied directly by an external webhook without resolving the integration mapping.

## Order normalization

External Swiggy order payloads must be mapped into the pixaPOS canonical order model.

Preserve:

- external order ID
- external order number/reference
- customer information only where permitted and necessary
- ordered items
- item quantities
- variants
- modifiers/add-ons
- special instructions
- taxes/charges where applicable
- discounts
- packaging/platform charges where applicable
- payment state
- fulfillment type
- delivery metadata where applicable
- timestamps
- external status
- cancellation/rejection information

Do not discard unknown provider fields immediately. Store a sanitized provider payload or metadata snapshot when legally and operationally appropriate.

## Menu mapping

Do not assume pixaPOS and Swiggy have identical menu structures.

Use explicit mapping:

pixaPOS category
  -> external category

pixaPOS item
  -> external item

pixaPOS variant
  -> external variant

pixaPOS modifier group
  -> external modifier/add-on group

pixaPOS modifier
  -> external modifier/add-on

Each mapping should have:

- internal ID
- external ID
- mapping status
- last sync status
- last sync timestamp
- sync error
- provider metadata

Use stable internal IDs. Never use item names as identifiers.

## Variants and modifiers

Your pixaPOS menu supports variable products.

Do not flatten variants into unrelated products unless the Swiggy contract requires it.

A safe normalized representation is:

Menu Item
  ├── Variant
  │    └── Modifier Groups
  │          └── Modifiers
  └── Availability

When Swiggy's model differs, implement a provider-specific mapper rather than changing the canonical POS model.

## Inventory / availability

Availability synchronization must be explicit.

Examples of state:

- available
- unavailable
- temporarily unavailable
- outlet unavailable
- provider unavailable
- sync pending
- sync failed

Do not silently change pixaPOS stock based on an external provider event unless the business rule explicitly permits it.

Prefer:

pixaPOS availability state
  -> channel-specific availability projection

This allows Swiggy, Zomato and future channels to have different availability states.

## Order lifecycle

Do not hard-code Swiggy statuses directly into the internal order state machine.

Use a translation layer:

external status
  -> normalized status
  -> POS/KOT/KDS action

For example:

External order received
  -> NEW
  -> create/attach KOT

Accepted
  -> ACCEPTED
  -> send to KDS/KOT workflow

Ready
  -> READY

Completed/picked up
  -> COMPLETED

Cancelled/rejected
  -> CANCELLED

The exact external status values and supported transitions MUST be verified against the current official Swiggy restaurant integration contract before implementation.

## Idempotency

External platforms retry requests.

Every inbound event must be idempotent.

Use a unique event key based on the provider's event/order identifiers where the contract supports them.

Recommended flow:

1. Receive event.
2. Authenticate/validate it.
3. Resolve integration outlet.
4. Check whether the event/order transition was already processed.
5. Persist the event.
6. Apply the state transition transactionally.
7. Trigger downstream POS/KOT/KDS work.
8. Mark processing complete.
9. Return the provider-required response.

Never create duplicate orders because a webhook was delivered twice.

## Webhooks

For restaurant partner webhooks:

- expose a dedicated server endpoint
- verify authentication/signature according to Swiggy's documented contract
- validate payload schema
- resolve external outlet
- persist the raw/sanitized event
- process asynchronously where appropriate
- return the provider-required acknowledgement quickly
- retry internal processing safely
- provide dead-letter/error visibility

Do not perform long-running menu or order processing before acknowledging a webhook if the provider contract expects a fast acknowledgement.

## Retry policy

Use bounded retries with exponential backoff for transient failures.

Do not retry:

- invalid authentication
- invalid payload
- permanent mapping errors
- unsupported operations

Retry carefully for:

- timeout
- connection reset
- 429/rate limit
- documented 5xx responses

Honor provider-specific retry-after information when supplied.

## Observability

Every Swiggy integration operation should be traceable.

Log:

- workspace ID
- restaurant ID
- outlet ID
- provider
- operation
- external ID
- internal ID
- request correlation ID
- response status
- duration
- retry count

Never log:

- access tokens
- client secrets
- authorization codes
- sensitive customer information unnecessarily
- complete payment credentials

Create an integration health view showing:

- connection status
- last successful sync
- last failed sync
- pending events
- failed events
- menu sync status
- order sync status

## Development strategy

Build a `SwiggyProvider` interface first.

Example conceptual interface:

```ts
interface SwiggyProvider {
  testConnection(): Promise<IntegrationHealth>;
  syncMenu(input: SyncMenuInput): Promise<SyncResult>;
  syncAvailability(input: SyncAvailabilityInput): Promise<SyncResult>;
  handleInboundEvent(input: InboundEvent): Promise<EventResult>;
  getOrderStatus(input: GetOrderStatusInput): Promise<ExternalOrderStatus>;
}
```

Only add methods that are actually supported by the Swiggy restaurant integration contract.

If a capability is not documented or not granted to the account, do not fake it.

## Mock provider

Before production access is available, implement:

`MockSwiggyProvider`

It should simulate:

- order received
- duplicate event
- order accepted
- order cancelled
- item unavailable
- menu sync
- sync failure
- retryable provider failure

This allows KOT/KDS and order orchestration to be developed without real Swiggy credentials.

## Testing

Minimum tests:

### Mapping
- item mapping
- variant mapping
- modifier mapping
- tax/charge mapping
- discount mapping
- unknown item handling

### Orders
- new order
- duplicate order
- duplicate event
- status transition
- cancellation
- partial mapping failure
- malformed payload

### Reliability
- timeout
- retry
- rate limit
- provider 5xx
- webhook replay
- out-of-order events

### Multi-tenancy
- wrong workspace
- wrong outlet
- unknown external outlet
- revoked integration
- disabled integration

### Security
- invalid webhook authentication
- invalid signature
- expired credentials
- secret leakage prevention

## Important distinction: Swiggy public MCP vs restaurant POS

Swiggy's current public Builders Club documentation describes Food MCP capabilities such as restaurant search, menus, carts, food ordering and order tracking. It uses OAuth 2.1 + PKCE for the MCP platform.

Those APIs are designed for applications/agents interacting with Swiggy as a consumer-facing commerce platform.

Do NOT use:

`place_food_order`

or other consumer Food MCP tools as a substitute for a restaurant receiving Swiggy marketplace orders into its POS.

For pixaPOS restaurant integration, use the Swiggy-approved restaurant/enterprise partner integration contract supplied to the POS vendor.

If that contract is not available, stop at the adapter boundary and ask for the official partner API specification rather than reverse-engineering private endpoints.

## Current official documentation note

Swiggy's public developer portal currently exposes API infrastructure, while the Builders Club provides public MCP/API documentation and an enterprise integration program.

The official coding-agent documentation explicitly instructs agents to consult the Swiggy Builders Club docs before using tool names, parameters, error codes, rate limits, or authentication flows.

Use those docs as the source of truth for the public MCP/API surface, but do not infer restaurant-POS capabilities from them.

## Definition of done

A Swiggy restaurant integration is not complete merely because an API call succeeds.

Before production:

- official partner access obtained
- exact restaurant integration contract documented
- outlet mapping tested
- menu mapping tested
- variants/modifiers tested
- availability sync tested
- order ingestion tested
- duplicate events tested
- cancellation/rejection tested
- KOT/KDS flow tested
- retry behavior tested
- authentication verified
- webhook security verified
- observability enabled
- production secrets secured
- reconciliation procedure documented
- failure/recovery procedure documented
- Swiggy certification/onboarding requirements completed where applicable

Never mark the integration production-ready until the applicable Swiggy partner requirements have been verified.
