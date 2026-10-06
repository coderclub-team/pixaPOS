---
name: zomato-pos-integration
description: Implement and maintain Zomato POS Integration for a restaurant POS/SaaS such as pixaPOS. Use for menu sync, item stock, order relay, order status, cancellations, outlet controls, webhooks, testing, idempotency, and Zomato integration architecture. Treat Zomato's official developer documentation as the source of truth and never invent undocumented endpoints, payloads, authentication details, status values, or onboarding requirements.
---

# Zomato POS Integration Skill

## Purpose

Build a production-grade Zomato POS integration for pixaPOS or a similar restaurant POS. Zomato's POS platform currently covers three major areas: Menu Management, Order Management, and Outlet Management. POS-to-Zomato communication uses REST/JSON APIs, while Zomato-to-POS events are delivered through configured webhooks.

## Source of truth

Use Zomato's official POS Integration API documentation as authoritative:

- Overview: https://www.zomato.com/developer/integration/docs/overview/
- Prerequisites: https://www.zomato.com/developer/integration/docs/getting-started/prerequisites/
- Critical feature list: https://www.zomato.com/developer/integration/docs/getting-started/critical-feature-list/
- API documentation: https://www.zomato.com/developer/integration/docs/api-documentation/
- Milestones: https://www.zomato.com/developer/integration/docs/getting-started/milestones/
- Pre-integration: https://www.zomato.com/developer/integration/docs/getting-started/development-for-integration/pre-integration/
- Post-integration: https://www.zomato.com/developer/integration/docs/getting-started/development-for-integration/post-integration/

If this skill conflicts with current Zomato documentation, the official documentation wins.

## Important onboarding constraint

Do not represent Zomato integration as generally available to every POS vendor. Current Zomato documentation lists minimum prerequisites including either 50 onboarded restaurants or 10,000 monthly orders, with final eligibility decided by Zomato. It also requires 100% parity with the critical feature list, a dedicated 24x7 on-call channel, and greater than 99.999% overall uptime. Confirm current requirements before making product commitments.

## Architecture for pixaPOS

Keep Zomato integration isolated from core POS domain logic.

Recommended structure:

```text
src/
  modules/
    integrations/
      zomato/
        client/
        menu/
        orders/
        outlet/
        webhooks/
        mapping/
        validation/
        jobs/
        types/
        errors/
        logs/
```

Use an adapter boundary:

```text
Core POS Domain
      |
      v
Zomato Integration Adapter
      |
      +--> Zomato API Client
      +--> Webhook Handlers
      +--> Mapping / Validation
      +--> Retry / Idempotency
      +--> Integration Logs
```

Never couple Zomato-specific fields directly into the primary product/order schema when an integration mapping table or integration metadata object is more appropriate.

## Core integration model

Maintain explicit mappings between pixaPOS entities and Zomato entities.

At minimum, plan for:

- workspace/tenant
- outlet
- Zomato restaurant/store identifier
- menu/category/subcategory/item identifiers
- variant identifiers
- modifier/add-on group identifiers
- order identifiers
- integration status
- last sync timestamps
- last webhook event identifiers where available
- sync/error state

Use stable internal IDs and store external Zomato IDs separately.

## Menu integration

Zomato supports menu synchronization and stock management. Current official documentation includes:

- Add Menu: `/online-ordering/v3/menu/add`
- Get Menu: `/online-ordering/v3/menu/get`
- Update Stock Status: `/online-ordering/v3/menu/item/stock`
- Menu Processing Status webhook
- Menu Moderation Status webhook

The menu request represents the restaurant's current menu snapshot. The official documentation states that only entities sent in the menu API call are retained after processing; therefore, do not casually send partial menus when implementing full menu sync.

For existing menu entities, do not rely on `inStock` in the full menu payload to update stock. Use the stock API for existing items/variants as documented by Zomato.

Important mapping requirements include:

- unique `vendorEntityId` within the applicable entity type
- category/subcategory/item/variant/modifier-group relationships
- dietary tags
- GST classification where required
- variant pricing
- variant stock
- add-on/modifier groups
- item descriptions
- category and subcategory timing
- category/subcategory scheduling
- item/category OOS
- supported charges/taxes

Before implementing payloads, read the current Zomato menu API reference because validation rules can change.

## Order integration

Current official order APIs include:

- Confirm: `/online-ordering/v1/order/confirm`
- Reject: `/online-ordering/v1/order/reject`
- Ready: `/online-ordering/v1/order/ready`
- Picked up: `/online-ordering/v1/order/pickedup`
- Assigned delivery partner: `/online-ordering/v1/order/assigned`
- Delivered: `/online-ordering/v1/order/delivered`
- Get contact details: `/online-ordering/v1/order/get-contact-details`
- Merchant-agreed cancellation update: `/online-ordering/v1/mac/update`

Relevant inbound webhooks include order relay, order status update, fetch-order-status, delivery-partner status, ratings, complaints, and merchant-agreed-cancellation events.

Implement order handling as an event-driven workflow:

```text
Zomato Order Relay Webhook
        |
        v
Validate + Authenticate
        |
        v
Persist Raw Event
        |
        v
Idempotency Check
        |
        v
Map to Core Order
        |
        v
Create/Update POS Order
        |
        v
Notify POS / KOT / KDS
        |
        v
Send Confirm / Reject
        |
        v
Send Ready / Pickup / Delivered as appropriate
```

Do not make the webhook handler depend on a long-running synchronous POS operation. Persist the event first, then process asynchronously where possible.

## Order status design

Keep Zomato order status separate from internal pixaPOS order/KOT/KDS status.

Example conceptual model:

```text
pixaPOS order
  status: RECEIVED | CONFIRMED | PREPARING | READY | COMPLETED | CANCELLED

Zomato integration state
  externalStatus: <Zomato documented status>
  externalOrderId: string
  lastSyncedAt: datetime
```

Do not assume Zomato's status names map 1:1 to pixaPOS statuses.

## Webhook rules

Webhook endpoints should be:

- authenticated according to the credentials/headers provided by Zomato
- HTTPS in production
- fast to acknowledge
- idempotent
- observable
- safe to retry
- protected against duplicate delivery

Store enough information to diagnose every event:

```text
integration
outlet
webhook type
receivedAt
external event/order id
request headers required for diagnostics
raw payload or secure payload reference
processing status
error code/message
processedAt
retry count
```

Do not log secrets, API keys, authorization headers, customer private data, or masked/unmasked contact details unnecessarily.

## Idempotency

Assume webhook delivery and retry can produce duplicates.

Before creating a new order from an inbound event:

1. derive the external event/order identity from the documented payload
2. check the integration event/order mapping
3. if already processed, return a successful acknowledgement without duplicating the business operation
4. if not processed, persist and process it transactionally

For outbound mutations, use the idempotency/retry behavior documented by Zomato rather than inventing unsupported headers or semantics.

## Retry strategy

Separate failures into:

- validation errors: do not blindly retry
- authentication/configuration errors: alert integration administrators
- rate limiting/transient network errors: retry with bounded exponential backoff
- 5xx/server failures: retry with bounded backoff
- business rejection: persist the reason and surface it to staff

Never create an infinite retry loop.

## KOT/KDS integration

Zomato orders should enter the same internal order pipeline as other online orders.

Recommended:

```text
Zomato
  -> Integration
  -> Online Order
  -> pixaPOS Order
  -> KOT
  -> KDS
```

Do not create a separate kitchen implementation only for Zomato. The source/channel should identify the order:

```text
order.source = ZOMATO
```

while KOT/KDS logic remains channel-independent.

## Menu mapping strategy

Do not assume pixaPOS and Zomato have identical catalog structures.

Create an explicit mapping layer:

```text
pixaPOS Category       <-> Zomato Category
pixaPOS Subcategory    <-> Zomato SubCategory
pixaPOS Product        <-> Zomato Catalogue
pixaPOS Variant        <-> Zomato Variant
pixaPOS ModifierGroup  <-> Zomato ModifierGroup
pixaPOS Addon          <-> Zomato Addon
```

A mapping record should support:

```text
workspaceId
outletId
provider = ZOMATO
localEntityType
localEntityId
externalEntityType
externalEntityId
syncStatus
lastSyncedAt
lastError
```

## Stock synchronization

Treat stock as a separate integration concern from full menu synchronization.

Recommended internal flow:

```text
POS stock changes
      |
      v
Integration queue
      |
      v
Zomato stock API
      |
      v
Success / failure
```

Avoid sending a full menu for every stock change unless specifically required by the current Zomato API contract.

## Outlet controls

Zomato's critical feature list includes:

- store operational hours
- turn outlet on/off
- offline reason API
- Zomato Help Centre access from the POS

Represent outlet integration state explicitly rather than deriving it from local business hours alone.

## Development phases

Follow Zomato's documented integration milestones:

1. Initial setup and onboarding
2. Development
3. Integration testing using a mock server
4. End-to-end testing with Zomato endpoints
5. Feature demo
6. Pilot launch
7. Monitoring and gradual scaling

Build a mock Zomato provider before connecting production endpoints.

## Mock provider

Create a local interface such as:

```ts
interface FoodDeliveryProvider {
  syncMenu(input: SyncMenuInput): Promise<SyncResult>;
  updateItemStock(input: UpdateStockInput): Promise<SyncResult>;
  confirmOrder(input: ConfirmOrderInput): Promise<ProviderResult>;
  rejectOrder(input: RejectOrderInput): Promise<ProviderResult>;
  markReady(input: ReadyOrderInput): Promise<ProviderResult>;
  fetchOrderStatus(input: FetchOrderStatusInput): Promise<ProviderOrderStatus>;
}
```

Implement:

```text
MockZomatoProvider
ZomatoProvider
```

against the same interface.

## Security

Never put Zomato API credentials in the browser or Next.js client components.

Use server-side code only for:

- Zomato API calls
- webhook authentication
- secret storage
- integration credentials

For a Next.js application, keep provider credentials in server-only environment/configuration or a secrets manager. Never expose them through `NEXT_PUBLIC_*` variables.

## Next.js implementation guidance

Recommended separation:

```text
app/api/integrations/zomato/webhooks/...   -> inbound webhook routes
server/integrations/zomato/...             -> provider client
server/integrations/zomato/mappers/...     -> mapping
server/integrations/zomato/jobs/...        -> async jobs
server/integrations/zomato/validators/...  -> validation
```

Route handlers should remain thin. Business logic belongs in service modules.

## Database guidance

Prefer integration-specific tables rather than adding many nullable Zomato columns to every core table.

Example conceptual tables:

```text
integration_connections
integration_entity_mappings
integration_webhook_events
integration_sync_runs
integration_errors
```

Use unique constraints to prevent duplicate external mappings.

## Observability

Track at least:

- webhook receive latency
- webhook processing latency
- outbound API latency
- API success/failure rate
- retry count
- menu sync duration
- menu sync failures
- order relay failures
- order acknowledgement latency
- orders stuck in intermediate states
- outlet sync state

Create an integration health view for administrators.

## Error handling UX

Staff should see actionable errors, for example:

```text
Zomato order could not be confirmed.
Reason: Zomato rejected the request.
Action: Review the order and integration status.
```

Do not expose raw API responses or secrets to restaurant staff.

## Implementation rules for the coding agent

When asked to implement Zomato integration:

1. Read this skill first.
2. Inspect the existing pixaPOS order, menu, outlet, KOT, KDS, and integration models before changing them.
3. Check the current official Zomato documentation before implementing an endpoint or payload.
4. Never invent missing API fields.
5. Keep provider-specific code isolated behind an adapter.
6. Use the existing authentication, database, queue, logging, and error-handling infrastructure when available.
7. Make webhook processing idempotent.
8. Add tests for happy paths, duplicate webhooks, invalid payloads, provider errors, retries, and partial failures.
9. Add migrations before using new integration tables.
10. Do not put provider secrets in client-side code.
11. Do not mark an integration feature complete until it satisfies the corresponding current Zomato critical feature requirement.
12. If official documentation is ambiguous, stop and identify the ambiguity instead of guessing.

## Current critical-feature checklist

Before considering the integration production-ready, verify the current Zomato critical feature list, including the documented requirements for:

### Menu

- add item
- add category/subcategory
- veg/non-veg tags
- prices
- charges and taxes
- timings/schedules
- variants
- add-ons
- descriptions
- category tags
- OOS
- deletion
- GST 9(5) where applicable
- nutritional information
- item details
- variant pricing
- variant OOS
- meat type tags where applicable
- add-on dietary tags
- serving information

### Orders

- order notification
- reject order
- rejection reasons
- IOOS rejection handling
- kitchen preparation time
- mark ready
- order summary
- return flow
- item OOS
- no cutlery/cooking instructions
- merchant-agreed cancellation
- call masking where applicable
- bulk order support where applicable
- fetch order status

### Outlet

- operational hours
- outlet on/off
- offline reason
- Zomato Help Centre access

The list above is a planning checklist; always compare it with the live official critical-feature documentation before release.

## Do not do

- Do not scrape Zomato.
- Do not automate the consumer Zomato website as a substitute for the official POS API.
- Do not invent undocumented endpoints.
- Do not hard-code production credentials.
- Do not treat a webhook as exactly-once delivery.
- Do not create duplicate orders when a webhook is retried.
- Do not mix Zomato-specific status values into generic KDS logic.
- Do not claim Zomato certification, approval, or production access unless it has actually been granted.
