# pixaPOS — Multi-Outlet SaaS Plans, Strict Free Limits & Neon Usage Quotas

You are a senior SaaS architect and full-stack engineer working on pixaPOS, an existing restaurant POS SaaS application.

The application is already implemented. Do not rewrite the application or introduce a new architecture unnecessarily. Extend the existing architecture cleanly.

## Existing Stack

- Next.js App Router
- React
- TypeScript
- Better Auth
- Better Auth Organization plugin
- Neon PostgreSQL
- Neon Object Storage
- Neon Serverless Functions
- Vercel
- shadcn/ui
- Tailwind CSS
- Existing organization/workspace/outlet concepts
- Existing custom role/permission system

The goal is to add strict SaaS plan limits, multi-outlet support, usage tracking and Neon-cost protection.

---

# 1. Business Context

pixaPOS is an early-stage startup with approximately ₹1,00,000 initial investment.

Therefore:

> The free Starter plan must be deliberately restrictive.

We cannot afford unlimited free customers consuming database, storage, compute, serverless functions, bandwidth or other infrastructure resources.

The architecture must make it difficult for a free customer to accidentally create significant infrastructure costs.

At the same time, the system must be designed so that successful restaurants can upgrade to Growth or Custom plans without requiring an architectural rewrite.

---

# 2. Core SaaS Model

Use this hierarchy:

```text
User
  ↓
Organization
  ↓
Subscription / Plan
  ↓
Outlets
  ↓
Operational data
```

## Organization

The organization is the billing and ownership boundary.

Example:

```text
ABC Foods Pvt Ltd
```

## Outlet

An outlet is a physical restaurant/location.

Example:

```text
ABC Foods
 ├── Dindigul
 ├── Madurai
 └── Chennai
```

## Subscription

The subscription belongs to the organization, not the individual outlet.

Example:

```text
Organization: ABC Foods
Plan: Growth
Allowed Outlets: 5
```

---

# 3. IMPORTANT — Do NOT Create One Neon Project Per Outlet

Use:

```text
1 Organization
        ↓
1 Neon Project
        ↓
Multiple Outlets
```

Do NOT use:

```text
Organization
 ├── Neon Project 1 → Outlet 1
 ├── Neon Project 2 → Outlet 2
 └── Neon Project 3 → Outlet 3
```

This would create unnecessary infrastructure complexity and cost.

However, design the abstraction so that a very large enterprise could eventually be moved to multiple Neon projects without changing the application-level organization model.

---

# 4. Plans

Implement three plan tiers.

### Critical Product Principle

**Starter and Growth have identical features.**  
There is **no feature gating** between Starter and Growth.

Both plans include the full pixaPOS operating system with no module-based restrictions:

```text
• Multi-outlet dashboard & reports
• Central menu, pricing & tax
• Free restaurant ecommerce website with delivery radius control
• Online ordering, kiosk & QR ordering
• Inventory, batches & wastage
• Promos, rewards & customers
• Zomato / Swiggy relay
• Table, counter, takeaway & delivery
• KOT, KDS and billing workflow
• PWA POS across phone, tablet and desktop
• POS, KDS, KOT & tables
• UPI / cash collection
• Daily sales reports
• Priority support (Growth+)
```

The only differences between Starter and Growth are **limits** (outlets, users, devices, orders, storage, etc.).

---

## Starter — Full platform access (Restrictive Limits)

```text
Price:                  ₹499 / outlet / month
Outlets:                1
Users:                  2
POS/KOT Devices:        2
Orders / month:         500
Products / Menu Items:  100
Customers:              250
Database Storage:       250–500 MB
Object Storage:         250 MB
```

Starter includes the complete product. The commercial model uses strict limits to protect infrastructure costs.

---

## Growth Plan

Suitable for small restaurant chains / multi-outlet businesses.

```text
Price:                  ₹1,599 / outlet / month
Outlets:                5
Users:                  25
POS/KOT Devices:        20
Orders / month:         10,000
Products / Menu Items:  2,000
Customers:              10,000
Database Storage:       2–7 GB
Object Storage:         5–7 GB
```

All features same as Starter.

---

## Custom Plan

For chains, franchises and enterprise customers.

Everything is configurable:

```text
maxOutlets
maxUsers
maxDevices
maxOrdersPerMonth
maxProducts
maxCustomers
maxDatabaseStorageBytes
maxObjectStorageBytes
maxComputeCuHours
maxFunctionInvocations
maxTransferBytes
feature flags
API limits
retention
support level
```

Custom plans support organization-specific overrides.

Example:

```text
Base Plan: CUSTOM

Overrides:
maxOutlets = 50
maxUsers = 300
maxDevices = 200
maxDatabaseStorage = 50 GB
maxObjectStorage = 100 GB
```

---

# 5. VERY IMPORTANT — Separate Business Limits From Infrastructure Limits

Do NOT treat these as the same thing.

There are two different quota systems.

## A. Product / Business Entitlements

```text
maxOutlets
maxUsers
maxDevices
maxOrdersPerMonth
maxProducts
maxCustomers
```

## B. Infrastructure Quotas

Track:

```text
database storage
database compute
database written data
database transfer
object storage
serverless function invocations
serverless function execution
```

Neon is an infrastructure cost layer.  
Do **not** expose Neon pricing directly as the customer-facing pricing model.

---

# 6. Plan Configuration

Create a centralized configuration/model similar to:

```ts
type PlanCode = "starter" | "growth" | "custom";

type PlanLimits = {
  maxOutlets: number;
  maxUsers: number;
  maxDevices: number;

  maxOrdersPerMonth: number;
  maxProducts: number;
  maxCustomers: number;

  maxDatabaseStorageBytes: number;
  maxObjectStorageBytes: number;

  maxComputeCuHours: number;
  maxFunctionInvocations: number;
  maxTransferBytes: number;
};

type PlanFeatures = {
  // Intentionally empty / all true for Starter & Growth
  // Only used for future Custom feature flags if needed
};
```

Adapt this to the existing database architecture rather than blindly creating duplicate models.

**Important:** Since Starter and Growth have the same features, the `PlanFeatures` object should return `true` for all standard features on both plans.

---

# 7. Organization Database Model

The organization should be the tenant boundary.

Conceptually:

```text
organizations

id
name
slug
status
created_at
updated_at
```

Subscription:

```text
subscriptions

id
organization_id
plan_id
status
billing_provider
billing_customer_id
current_period_start
current_period_end
```

Plans:

```text
plans

id
code
name
limits
features
active
```

Outlets:

```text
outlets

id
organization_id
name
code
slug
timezone
country
currency
status
created_at
updated_at
```

Use the existing Better Auth organization tables where appropriate.

**Do not duplicate Better Auth organization functionality unnecessarily.**

---

# 8. Outlet Ownership

Operational data should contain both:

```text
organization_id
outlet_id
```

Where appropriate.

Examples:

```text
orders
order_items
tables
kot
kds
inventory
stock_movements
recipes
cash_settlements
devices
customers
outlet_menu_items
```

This gives us:

```text
organization_id → tenant isolation
outlet_id       → physical restaurant isolation
```

Never rely only on `outlet_id`.

---

# 9. Organization-Level Data

Some entities should remain organization-level.

Examples:

```text
subscription
billing
organization members
organization settings
brand settings
central menu
global permissions
```

For chain functionality:

```text
Organization Menu
       ↓
Outlet Menu Mapping
       ↓
Outlet-specific price / availability / tax
```

This allows:

```text
Central Menu Item
      ↓
Outlet A → ₹120
Outlet B → ₹140
Outlet C → unavailable
```

---

# 10. User Access

Implement an outlet-scoping concept:

```text
Allowed Outlets
Default Outlet
```

Example:

```text
User: Manager

Allowed outlets:
- Dindigul
- Madurai
- Chennai

Default:
- Madurai
```

Staff:

```text
User: Cashier

Allowed outlets:
- Dindigul

Default:
- Dindigul
```

Do not allow the frontend to arbitrarily select another outlet.

Every server-side operation must verify:

```text
authenticated user
        ↓
organization membership
        ↓
outlet access
        ↓
permission
        ↓
resource
```

---

# 11. Entitlement Service

Create one centralized entitlement service.

Example API:

```ts
can(organizationId, "multiOutlet")
can(organizationId, "advancedReports")

requireFeature(organizationId, "multiOutlet")

checkLimit(
  organizationId,
  "outlets",
  requestedAmount
)

requireLimit(
  organizationId,
  "users",
  requestedAmount
)
```

Do NOT scatter checks such as:

```ts
if (plan === "growth") {
   ...
}
```

throughout the application.

The application should instead ask:

```ts
await entitlement.requireFeature(
  organizationId,
  "multiOutlet"
);
```

This will make future plan changes easy.

---

# 12. Server-Side Enforcement Is Mandatory

Never depend on UI restrictions.

For example:

The UI can hide:

```text
+ Add Outlet
```

but the API must independently enforce:

```text
POST /api/outlets

authenticate
↓
resolve organization
↓
check subscription
↓
count existing outlets
↓
compare against maxOutlets
↓
create outlet
```

The same pattern must apply to:

- users
- devices
- products
- customers
- orders
- storage uploads
- API usage
- other quota-controlled resources

---

# 13. Starter Plan Protection

The most important requirement:

> **A free customer must not be able to generate significant infrastructure cost.**

Implement hard limits.

For example:

```text
Starter:

1 outlet
2 users
2 devices
250–500 MB DB
250 MB object storage
500 orders/month
100 products
250 customers
```

Once a hard limit is reached:

```text
BLOCK
```

Do not silently continue consuming paid infrastructure.

Show a clear upgrade message.

Example:

```text
You've reached your Starter plan limit.

Orders this month:
500 / 500

Upgrade to Growth to continue accepting orders.
```

---

# 14. Soft Warning Thresholds

For resource-based quotas use:

```text
70% → informational
80% → warning
90% → strong warning
100% → enforce limit
```

Example:

```text
Database
████████████████░░░░
82 MB / 100 MB

You're approaching your Starter database limit.
```

---

# 15. Usage Tracking

Create an organization-level usage system.

Conceptually:

```text
organization_usage

organization_id
period_start
period_end

database_storage_bytes
object_storage_bytes

compute_cu_hours
function_invocations
written_data_bytes
transfer_bytes

orders_count
products_count
customers_count
users_count
outlets_count
devices_count
```

Do not calculate expensive usage metrics on every request.

Use counters and periodic aggregation.

---

# 16. Neon Usage

Where supported by Neon, periodically retrieve usage/consumption information.

Track metrics such as:

```text
compute
storage
written data
data transfer
branch/database size
```

Synchronize usage periodically, for example:

```text
hourly
```

Do NOT call Neon usage APIs on every POS request.

Architecture:

```text
Neon
  ↓
Usage Sync Job
  ↓
organization_usage
  ↓
SaaS Dashboard
```

---

# 17. Important Cost-Safety Principle

Do not assume:

```text
Starter = Neon Free Plan
Growth = Neon paid usage
Custom = bigger Neon
```

Instead:

```text
pixaPOS Plan
     ↓
Business Entitlements
     ↓
Infrastructure Budget
     ↓
Actual Neon Consumption
```

We control the customer's product limits independently from Neon.

This gives us a margin between:

```text
customer revenue
        vs
infrastructure cost
```

---

# 18. Cost Guardrails

Implement protection against abnormal usage.

Examples:

```text
maximum upload size
maximum image size
maximum request payload
maximum API requests
maximum orders/month
maximum object storage
maximum database size
maximum function execution
```

For uploads:

```text
Starter:
small image/file limits

Growth:
larger limits

Custom:
configurable
```

Do not allow unlimited file uploads.

---

# 19. Usage Dashboard

Create:

```text
Settings
  → Billing
  → Usage & Limits
```

Show:

### Organization

```text
Plan: Starter
Billing: Free
```

### Outlets

```text
1 / 1
```

### Users

```text
2 / 2
```

### Devices

```text
1 / 2
```

### Orders

```text
321 / 500
```

### Database

```text
72 MB / 100 MB
```

### Object Storage

```text
180 MB / 250 MB
```

Use progress indicators and warning states.

---

# 20. Upgrade UX

When a limit is reached, provide a clear upgrade CTA.

Example:

```text
You've reached your Starter plan outlet limit.

Starter allows 1 outlet.

Upgrade to Growth to manage up to 5 outlets.
```

Do not simply return:

```text
403 Forbidden
```

without a useful explanation.

The API should still return a structured error:

```json
{
  "code": "PLAN_LIMIT_REACHED",
  "resource": "outlets",
  "current": 1,
  "limit": 1,
  "plan": "starter",
  "upgradeRequired": true
}
```

The frontend can render a proper upgrade experience.

---

# 21. Subscription States

Support:

```text
trial
active
past_due
cancelled
expired
suspended
```

Define behavior for each state.

For example:

### Active
Normal operation.

### Past Due
Allow limited access for a grace period.

### Expired
Prevent new resource creation.

Existing data should remain accessible according to the business policy.

### Suspended
Read-only or restricted operation.

Do not randomly delete customer data because a subscription expires.

---

# 22. Multi-Outlet UX

For Growth/Custom users:

Top navigation:

```text
[ All Outlets ▼ ]
```

Options:

```text
All Outlets
─────────────
Dindigul
Madurai
Chennai
```

When an outlet is selected:

```text
currentOutletId
```

must be resolved securely on the server.

Never trust:

```text
?outletId=123
```

by itself.

---

# 23. All-Outlets Mode

Only authorized users should see:

```text
All Outlets
```

Examples:

Owner:

```text
All Outlets ✓
```

Manager:

```text
Assigned outlets
```

Staff:

```text
Only assigned outlet
```

All-outlet dashboards should aggregate data efficiently.

Avoid loading every order from every outlet into the browser.

Use server-side aggregation.

---

# 24. Database Query Isolation

Every outlet-scoped query must include tenant context.

Example:

```ts
where(
  organizationId = currentOrganizationId,
  outletId = currentOutletId
)
```

Never query operational data only by:

```ts
id
```

without verifying ownership.

For example, this is dangerous:

```ts
db.orders.findFirst({
  where: eq(orders.id, orderId)
});
```

Prefer:

```ts
db.orders.findFirst({
  where: and(
    eq(orders.id, orderId),
    eq(orders.organizationId, organizationId),
    eq(orders.outletId, outletId)
  )
});
```

Adapt this to the project's existing ORM/query architecture.

---

# 25. Prevent Cross-Outlet Data Leakage

This is a critical security requirement.

A user from:

```text
Outlet A
```

must never be able to access:

```text
Outlet B
```

by changing:

```text
outletId
orderId
productId
inventoryId
```

in the request.

Test for IDOR/cross-tenant vulnerabilities.

---

# 26. Billing Boundary

The organization owns:

```text
subscription
plan
usage
billing customer
```

Not the outlet.

Correct:

```text
Organization
 ├── Subscription
 ├── Outlet A
 ├── Outlet B
 └── Outlet C
```

Incorrect:

```text
Outlet A → subscription
Outlet B → subscription
```

---

# 27. Growth Plan Should Be the Main Conversion Target

Because this is an early-stage startup, design the plans so that:

```text
Starter
   ↓
small restaurant
   ↓
Growth
   ↓
multi-outlet restaurant
   ↓
Custom
   ↓
chain/franchise
```

Starter should be useful enough to let a small restaurant try pixaPOS, but restrictive enough that serious usage naturally requires Growth.

Do NOT make the free plan so generous that a restaurant can operate indefinitely with significant usage at ₹0.

---

# 28. Avoid Premature Enterprise Complexity

Do not implement:

- one database per outlet
- one Neon project per outlet
- Kubernetes
- complex microservices
- distributed databases
- sharding
- complicated event infrastructure

unless the existing application already requires them.

Start with:

```text
Next.js
+
Neon
+
Better Auth
+
Organization
+
Outlets
+
Entitlements
+
Usage Tracking
```

This is sufficient.

---

# 29. Future Enterprise Architecture

However, create clean abstractions so this can evolve later:

```text
Organization
      ↓
Data Plane
      ↓
Neon Project
```

Initially:

```text
Organization A → Neon Project A
Organization B → Neon Project B
```

Each organization can therefore be isolated at the infrastructure level.

Within each organization:

```text
Organization
 ├── Outlet A
 ├── Outlet B
 └── Outlet C
```

If a large enterprise eventually requires isolation:

```text
Large Organization
       ↓
Data Plane 1 → Neon Project 1
Data Plane 2 → Neon Project 2
```

But this is future architecture only.

Do not implement it unless required.

---

# 30. Existing Application Compatibility

Before modifying anything:

1. Inspect the existing database schema.
2. Inspect Better Auth organization configuration.
3. Inspect existing workspace/outlet implementation.
4. Inspect existing permissions.
5. Inspect subscription/billing implementation.
6. Inspect all major outlet-scoped entities.
7. Identify where tenant/outlet context is currently resolved.
8. Identify existing middleware/server actions/API routes.
9. Identify existing storage upload code.
10. Identify existing background/cron infrastructure.

Then propose the smallest migration necessary.

**Do not duplicate existing functionality.**

---

# 31. Migration Strategy

Implement incrementally.

### Phase 1
Create/normalize:

```text
plans
subscriptions
outlet limits
entitlement service
```

### Phase 2
Implement:

```text
organization → multiple outlets
allowed outlets
default outlet
outlet switcher
```

### Phase 3
Implement:

```text
resource limits
server-side enforcement
```

### Phase 4
Implement:

```text
usage tracking
Neon usage synchronization
```

### Phase 5
Implement:

```text
Billing / Usage dashboard
upgrade UX
```

### Phase 6
Add:

```text
Growth multi-outlet features
central menu
chain dashboard
```

---

# 32. Tests Required

Add tests for:

### Tenant isolation

```text
Organization A cannot access Organization B.
```

### Outlet isolation

```text
Outlet A staff cannot access Outlet B.
```

### Plan limits

```text
Starter cannot create second outlet.
Starter cannot exceed user limit.
Starter cannot exceed device limit.
Starter cannot exceed order limit.
```

### Growth

```text
Growth can create multiple outlets up to limit.
```

### Custom

```text
Custom overrides are respected.
```

### Subscription states

```text
expired subscription cannot create new resources
```

### Security
Attempt:

```text
manually changing organizationId
manually changing outletId
manually changing resource IDs
```

and verify access is denied.

---

# 33. Do Not Over-Engineer Usage Metering

There is a difference between:

```text
hard product counters
```

and:

```text
infrastructure usage
```

Product counters can be maintained transactionally:

```text
orders_count
users_count
outlets_count
devices_count
```

Infrastructure metrics can be synchronized periodically:

```text
database storage
compute
transfer
object storage
functions
```

Do not make every POS transaction wait for a Neon usage API call.

POS operations must remain fast.

---

# 34. Admin Controls

Create an internal/admin capability to override limits.

Example:

```text
Organization
Plan: Growth

Override:
maxOutlets = 10
maxUsers = 50
maxDatabaseStorage = 5 GB
```

This will be important for:

- sales negotiations
- early customers
- pilots
- franchise customers
- support
- promotional accounts

---

# 35. Plan Configuration Must Be Data-Driven

Avoid:

```ts
if (plan === "starter") ...
if (plan === "growth") ...
```

Prefer:

```ts
const limits = await entitlementService.getLimits(orgId);

if (currentOutlets >= limits.maxOutlets) {
   throw new PlanLimitError(...);
}
```

This allows us to change:

```text
Starter: 1 outlet
```

to:

```text
Starter: 2 outlets
```

without changing business logic.

---

# 36. Deliverables

After inspecting the existing codebase, provide:

## A. Architecture Assessment

Explain:

- existing organization model
- existing outlet model
- existing subscription model
- what can be reused
- what must change

## B. Database Changes

Provide exact migrations/schema changes.

## C. Entitlement Service

Implement a centralized service for:

```ts
getPlan()
getLimits()
getFeatures()
can()
requireFeature()
checkLimit()
requireLimit()
getUsage()
```

## D. Server Enforcement

Integrate limits into the existing:

- API routes
- server actions
- mutations
- upload endpoints

## E. Outlet Context

Implement:

```text
current organization
current outlet
allowed outlets
default outlet
```

using the existing Better Auth organization/session system.

## F. Usage Tracking

Implement organization-level usage tracking and periodic infrastructure usage synchronization.

## G. Usage Dashboard

Implement a shadcn/ui dashboard for:

```text
Plan
Usage
Limits
Warnings
Upgrade CTA
```

## H. Tests

Add automated tests for:

```text
tenant isolation
outlet isolation
plan limits
resource limits
subscription states
custom overrides
```

---

# 37. Important Engineering Rules

1. **Do not rewrite the existing application.**
2. **Do not introduce a new authentication system.**
3. **Reuse Better Auth Organization.**
4. **Do not create one Neon project per outlet.**
5. **Do not trust organizationId/outletId from the client.**
6. **Every server-side mutation must enforce entitlements.**
7. **Never expose Neon secrets to the browser.**
8. **Never use NEXT_PUBLIC_ variables for secrets.**
9. **Do not call Neon usage APIs on every request.**
10. **Keep Starter intentionally restrictive.**
11. **Keep all limits configurable.**
12. **Support organization-specific overrides.**
13. **Keep billing at organization level.**
14. **Keep inventory and physical operations outlet-specific.**
15. **Prevent cross-tenant and cross-outlet data access.**
16. **Prefer simple architecture over premature enterprise infrastructure.**
17. **Preserve the existing pixaPOS architecture wherever possible.**

---

# 38. Final Goal

The final architecture should look approximately like:

```text
                    pixaPOS SaaS
                         │
                  ┌──────▼──────┐
                  │ Organization │
                  └──────┬──────┘
                         │
             ┌───────────▼───────────┐
             │ Subscription + Plan   │
             │ Entitlements + Quotas │
             └───────────┬───────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Outlet A          Outlet B         Outlet C
        │                │                │
   POS/KOT/KDS      POS/KOT/KDS      POS/KOT/KDS
   Inventory        Inventory        Inventory
   Tables           Tables           Tables
        │                │                │
        └────────────────┼────────────────┘
                         │
                  Neon PostgreSQL
                         │
              ┌──────────┴──────────┐
              │                     │
        Object Storage        Serverless Functions
              │                     │
              └──────────┬──────────┘
                         │
                  Usage Aggregator
                         │
                  Usage & Limits
                     Dashboard
```

The primary business objective is:

> **Protect pixaPOS from uncontrolled free-tier infrastructure costs while creating a clean path from one small restaurant → multi-outlet restaurant → chain/franchise.**

Before writing code, inspect the existing repository and produce a concise implementation plan identifying the exact files/models/services that need modification. Then implement the changes incrementally without breaking existing functionality.
```

The file is ready. You can download it here:

**[Download pixaPOS-SaaS-Plans-Strict-Limits-Neon-Quotas.md](sandbox:/home/workdir/artifacts/pixaPOS-SaaS-Plans-Strict-Limits-Neon-Quotas.md)**

Would you like any further adjustments (exact MB/GB values, pricing, etc.) before you start implementation?