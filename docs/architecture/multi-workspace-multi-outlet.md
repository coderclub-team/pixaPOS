# pixaPOS Multi-Workspace & Multi-Outlet Architecture

> Status: **adopted policy**. Source: workspace design note (Sep 2026),
> adapted into the repo with heading fixes and a code-alignment appendix.
> The Workspace = business/billing boundary, Outlet = operational boundary
> principle below is binding for all multi-outlet work.

## 1. Purpose

pixaPOS is a multi-tenant restaurant SaaS platform where a customer can manage one or more restaurant businesses (Workspaces), and each Workspace can contain multiple physical restaurant locations (Outlets).

The core architectural principle is:

> **Workspace = Business identity and billing boundary**
> **Outlet = Operational and data-isolation boundary**

A customer should not need to create a new Workspace simply because they open another restaurant branch.

---

## 2. Recommended Hierarchy

```text
User
  │
  ├── Workspace A
  │     │
  │     ├── Outlet 1
  │     ├── Outlet 2
  │     └── Outlet 3
  │
  └── Workspace B
        │
        ├── Outlet 1
        └── Outlet 2
```

Example:

```text
User
└── Yummy Roast
    ├── Erode Outlet
    ├── Salem Outlet
    └── Coimbatore Outlet
```

If the same user owns a completely separate business:

```text
User
├── Yummy Roast
│   ├── Erode
│   └── Salem
│
└── ABC Foods
    ├── Chennai
    └── Bangalore
```

---

## 3. Workspace

A Workspace represents a **restaurant business, organization, or customer account**.

### Workspace-level responsibilities

- Business identity
- Subscription
- Billing
- Workspace members
- Roles
- Permissions
- Company information
- Brand information
- Workspace-level settings
- Optional shared catalogs/templates

A Workspace can contain multiple Outlets.

### Example

```text
Workspace: Yummy Roast

Subscription:
  Growth Plan

Outlets:
  - Erode
  - Salem
  - Coimbatore
```

---

## 4. Outlet

An Outlet represents a **physical restaurant location**.

Each Outlet should operate independently for day-to-day restaurant operations.

### Outlet-level data

- Outlet information
- Suppliers
- Raw materials
- Inventory / stock
- Purchase orders
- Purchases
- Recipes
- Menu
- Menu pricing
- Tables
- Floor plans
- Orders
- KOT
- KDS
- Staff assignments
- Printers
- Devices
- Cash registers
- Expenses
- Customers, where applicable
- Outlet settings
- Payment configuration
- Tax configuration
- Receipt configuration

### Example

```text
Yummy Roast
│
├── Erode
│   ├── Suppliers
│   ├── Raw Materials
│   ├── Stock
│   ├── Purchases
│   ├── Recipes
│   ├── Menu
│   ├── Tables
│   ├── Orders
│   ├── KOT
│   ├── KDS
│   └── Printers
│
└── Salem
    ├── Suppliers
    ├── Raw Materials
    ├── Stock
    ├── Purchases
    ├── Recipes
    ├── Menu
    ├── Tables
    ├── Orders
    ├── KOT
    ├── KDS
    └── Printers
```

Data from one Outlet must not automatically appear in another Outlet.

---

## 5. Workspace vs Outlet Data

## Workspace-level

| Entity | Scope |
|---|---|
| Workspace | Workspace |
| Subscription | Workspace |
| Billing | Workspace |
| Workspace Members | Workspace |
| Roles | Workspace |
| Permissions | Workspace |
| Company Information | Workspace |
| Brand | Workspace |
| Optional Catalog Templates | Workspace |

## Outlet-level

| Entity | Scope |
|---|---|
| Outlet | Workspace |
| Suppliers | Outlet |
| Raw Materials | Outlet |
| Stock | Outlet |
| Purchase Orders | Outlet |
| Purchases | Outlet |
| Recipes | Outlet |
| Menu | Outlet |
| Menu Pricing | Outlet |
| Tables | Outlet |
| Floor Plans | Outlet |
| Orders | Outlet |
| KOT | Outlet |
| KDS | Outlet |
| Printers | Outlet |
| Devices | Outlet |
| Cash Registers | Outlet |
| Expenses | Outlet |
| Staff Assignments | Outlet |
| Outlet Settings | Outlet |

---

## 6. Inventory Isolation

Inventory must always be Outlet-specific.

For example:

```text
Erode:
  Chicken = 25 kg
  Milk = 30 L

Salem:
  Chicken = 12 kg
  Milk = 18 L
```

The same raw material name does not mean the stock is shared.

Recommended conceptual structure:

```text
stock
├── id
├── workspace_id
├── outlet_id
├── raw_material_id
├── quantity
├── unit
└── ...
```

Every stock transaction must belong to an Outlet.

---

## 7. Supplier Isolation

Initially, suppliers should be Outlet-specific.

Example:

```text
Erode
├── ABC Chicken Supplier
├── XYZ Dairy
└── Local Vegetables

Salem
├── Salem Foods
├── Fresh Dairy
└── City Vegetables
```

A supplier can later be shared across multiple Outlets if required.

A future advanced model can support:

```text
Workspace Supplier
       │
       ├── Erode Supplier Configuration
       └── Salem Supplier Configuration
```

This allows each Outlet to maintain different:

- Supplier codes
- Prices
- Payment terms
- Delivery settings
- Contacts
- Opening balances

---

## 8. Menu Architecture

Menu management may require both Workspace-level and Outlet-level concepts.

A recommended model is:

```text
Workspace
└── Menu Catalog
      │
      ├── Chicken Burger
      ├── French Fries
      ├── Coke
      └── Pizza
```

Each Outlet can decide whether an item is available and at what price.

Example:

```text
Chicken Burger

Erode:
  Enabled
  Price: ₹180

Salem:
  Enabled
  Price: ₹190

Coimbatore:
  Disabled
```

This allows centralized menu management while keeping Outlet-specific availability and pricing.

---

## 9. Outlet Settings

Settings should be split between Workspace and Outlet.

## Workspace Settings

```text
workspace_settings

- Business information
- Branding
- Company information
- Subscription-related settings
```

## Outlet Settings

```text
outlet_settings

- Receipt settings
- KOT settings
- KDS settings
- Printer settings
- Tax settings
- Payment settings
- Table settings
- Order settings
- Service charges
- Business hours
- Outlet-specific configuration
```

Example:

```text
Erode
  Receipt Printer → EPSON-01
  KOT Printer     → Kitchen-01

Salem
  Receipt Printer → EPSON-02
  KOT Printer     → Kitchen-02
```

---

## 10. User and Access Model

A user should not be permanently tied to a single Workspace.

Use a Workspace Membership model.

```text
User
  │
  ▼
Workspace Membership
  ├── workspace_id
  ├── user_id
  ├── role
  └── status
```

Then control Outlet access separately:

```text
Workspace Member
       │
       ▼
Member Outlet Access
  ├── member_id
  └── outlet_id
```

Example:

```text
Owner
  → Erode
  → Salem
  → Coimbatore

Manager
  → Erode
  → Salem

Captain
  → Erode

Kitchen Staff
  → Erode
```

This provides a scalable permission model for multi-outlet restaurants.

---

## 11. Tenant and Data Isolation

Every Outlet-owned record should contain both:

```text
workspace_id
outlet_id
```

Example:

```text
orders
├── id
├── workspace_id
├── outlet_id
├── ...
```

```text
stock
├── id
├── workspace_id
├── outlet_id
├── raw_material_id
├── quantity
└── ...
```

Although `outlet_id` can technically identify its Workspace, storing `workspace_id` explicitly makes tenant filtering, authorization, indexing, and data isolation easier.

Application queries should enforce the active context:

```text
workspace_id = currentWorkspace
AND
outlet_id = currentOutlet
```

This should be enforced consistently at the service/database authorization layer, not only through frontend filtering.

---

## 12. Subscription and Billing

The Workspace should be the primary customer/billing entity.

Recommended model:

```text
Workspace
   │
   └── Subscription
          ├── Plan
          ├── Outlet limit
          ├── User limit
          ├── Storage limit
          ├── Device limit
          └── Add-ons
```

A pricing model can combine:

```text
Base Workspace Plan
+
Active Outlet Charges
+
Optional Add-ons
```

Example:

```text
Growth Plan
₹X / month
Includes 1 Outlet

Additional Outlet
₹Y / month
```

The exact pricing is a business decision, but the architecture should support outlet-based usage limits.

See also: `docs/pixaPOS-saas-plans-indian-pricing.md` (parked draft — plan tiers, open pricing questions, do-not-touch list).

---

## 13. Workspace Creation vs Outlet Creation

The product UI should clearly distinguish these actions.

## Create Workspace

Use when the customer starts a **new business/organization**.

Example:

```text
Create Workspace

Business Name:
Yummy Roast

Business Type:
Restaurant
```

## Add Outlet

Use when the customer adds a **new physical location**.

Example:

```text
Add Outlet

Outlet Name:
Yummy Roast - Salem

Address:
Salem, Tamil Nadu

Timezone:
Asia/Kolkata
```

Opening a new branch should not require creating a new Workspace.

---

## 14. Application Context

The main restaurant application can use an active Workspace + Outlet context.

Example:

```text
app.pixapos.store
```

User selects:

```text
Workspace:
Yummy Roast

Outlet:
Erode
```

Then the application operates against:

```text
workspace_id = yummy_roast
outlet_id = erode
```

The user can switch:

```text
Yummy Roast
  └── Outlet: Erode ▼
```

to:

```text
Yummy Roast
  └── Outlet: Salem
```

The same application remains open, but the active Outlet context changes.

---

## 15. Multi-Outlet Dashboard

Workspace-level dashboards can aggregate Outlet data.

Example:

```text
Yummy Roast
────────────────────────────

Today's Sales

Erode          ₹42,500
Salem          ₹38,200
Coimbatore     ₹51,300
────────────────────────────
Total          ₹1,32,000
```

Outlet-level dashboards only show the selected Outlet.

```text
Erode Outlet
────────────────────────────

Today's Sales       ₹42,500
Orders                   182
KOTs                     174
Average Order Value    ₹234
```

This provides both operational and management views.

---

## 16. Recommended URL Context

The main application can use an explicit Outlet context.

Example:

```text
app.pixapos.store/o/erode/orders
app.pixapos.store/o/erode/inventory
app.pixapos.store/o/erode/purchases
```

For Workspace-level pages:

```text
app.pixapos.store/workspace/settings
app.pixapos.store/workspace/billing
app.pixapos.store/workspace/members
```

The exact URL structure can be changed later, but the application should always maintain an explicit active Workspace and Outlet context.

---

## 17. Architecture Principle

The key rule for pixaPOS is:

```text
Workspace
    = Business / Organization / Billing Boundary

Outlet
    = Physical Restaurant / Operational Boundary
```

Therefore:

```text
One Business
    → One Workspace
    → Multiple Outlets

One User
    → Multiple Workspace Memberships
    → Different roles
    → Different Outlet access
```

This supports:

- Single restaurant businesses
- Multi-branch restaurants
- Restaurant groups
- Franchise operators
- Users managing multiple independent businesses
- Central management with outlet-specific operations

---

## 18. Final Recommended Model

```text
                         pixaPOS
                            │
                           User
                            │
                ┌───────────┴───────────┐
                │                       │
          Workspace A             Workspace B
          Yummy Roast              ABC Foods
                │                       │
       ┌────────┼────────┐          ┌───┴───┐
       │        │        │          │       │
     Erode    Salem   Coimbatore   ABC-1   ABC-2
       │        │        │
       ▼        ▼        ▼
    Stock    Stock    Stock
    Menu     Menu     Menu
    KOT      KOT      KOT
    KDS      KDS      KDS
    Orders   Orders   Orders
    etc.     etc.     etc.
```

### Core decision

**Do not create a new Workspace for every Outlet.**

Create a new Workspace only when the customer has a **separate business/organization**.

Create a new Outlet when the customer opens a **new physical restaurant location**.

This keeps pixaPOS scalable while allowing every Outlet to maintain completely independent suppliers, raw materials, inventory, purchases, recipes, menus, printers, settings, KOT, KDS, and operational data.

---

## Appendix A. Current code alignment (Sep 2026)

- **Workspace = Better Auth organization.** `organization` table (id/slug/logo/metadata), org roles, membership, `baOrgs` client wrappers. Billing Razorpay phase is workspace-scoped by this policy.
- **Single-outlet phase:** all outlet reads resolve `out_001`; no outlet switcher, no member-outlet-access table yet. Second-outlet work starts with an `outlets` table + active-context plumbing (§14), not a second workspace.
- **Tenant columns:** records carry `outlet_id` (e.g. `orders`, indexes present). **`workspace_id` is missing on outlet-owned rows** — add it (with composite indexes) when the second outlet lands, per §11. Do not retrofit silently: migration + backfill + service-layer enforcement together.
- **Already outlet-scoped:** printers/routes/templates/jobs (`outlet_id` throughout Print Studio), UPI VPAs, outlet settings pages. Shared menu catalog (§8) and workspace supplier model (§7) are future — current menu/supplier code is single-outlet; do not assume sharing.
- **Subdomain map** (AGENTS.md) is orthogonal: surfaces route users, this document routes data. `app.pixapos.store/o/<outlet>/…` (§16) composes with it when context switching ships.
