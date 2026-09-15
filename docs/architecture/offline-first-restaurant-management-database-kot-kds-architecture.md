# Offline-First Restaurant Management System

## Database & KOT/KDS Architecture

## 1. Recommended Database Architecture

For a restaurant management system with **POS + KOT + KDS + Inventory** and strong **offline-first requirements**, use a **dual-database architecture**:

* **Local database:** SQLite / IndexedDB
* **Central database:** PostgreSQL
* **Sync layer:** Bidirectional synchronization between local and cloud databases

### High-Level Architecture

```text
                         CLOUD / SERVER
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    │     Central DB      │
                    │                     │
                    │  • Outlets          │
                    │  • Menu             │
                    │  • Orders           │
                    │  • KOT              │
                    │  • KDS              │
                    │  • Inventory        │
                    │  • Payments         │
                    │  • Reports          │
                    └──────────┬──────────┘
                               │
                          Sync API
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
          ┌──────▼──────┐             ┌──────▼──────┐
          │     POS     │             │     KDS     │
          │             │             │             │
          │  Next.js    │             │  Next.js    │
          │             │             │             │
          │ IndexedDB   │             │ IndexedDB   │
          │ / SQLite    │             │ / SQLite    │
          └─────────────┘             └─────────────┘
```

---

# 2. Why Offline-First?

Restaurant POS systems cannot depend entirely on the internet.

If the internet goes down:

```text
Internet OFF
     │
     ▼
  POS still works
     │
     ▼
Order created locally
     │
     ▼
KOT created locally
     │
     ▼
KDS receives KOT
     │
     ▼
Kitchen continues working
     │
     ▼
Internet returns
     │
     ▼
Data synchronizes with PostgreSQL
```

The restaurant should be able to continue taking orders and processing kitchen tickets even during an internet outage.

---

# 3. Database Selection

| Database       | Recommended Use               | Rating |
| -------------- | ----------------------------- | -----: |
| **SQLite**     | Local desktop/mobile POS      |  ⭐⭐⭐⭐⭐ |
| **PostgreSQL** | Central cloud database        |  ⭐⭐⭐⭐⭐ |
| **IndexedDB**  | Browser-based local storage   |  ⭐⭐⭐⭐⭐ |
| MySQL          | Central database              |   ⭐⭐⭐⭐ |
| MongoDB        | This use case                 |     ⭐⭐ |
| Firebase       | Possible alternative          |    ⭐⭐⭐ |
| Supabase       | PostgreSQL + backend services |  ⭐⭐⭐⭐⭐ |

## Recommended

```text
Local:
IndexedDB / SQLite

Cloud:
PostgreSQL

Synchronization:
Custom Sync Engine
```

---

# 4. Browser-Based POS

If the POS is a pure web application running inside Chrome/Safari:

```text
Next.js
   │
   ▼
IndexedDB
   │
   ▼
Sync Engine
   │
   ▼
API
   │
   ▼
PostgreSQL
```

IndexedDB is preferable for a browser-first application because the browser cannot simply use a traditional SQLite file like a desktop application can.

---

# 5. Desktop POS

If the POS is packaged as a desktop application using something such as Tauri or Electron:

```text
Next.js
   │
   ▼
Tauri / Electron
   │
   ▼
SQLite
   │
   ▼
Sync Engine
   │
   ▼
PostgreSQL
```

SQLite provides a strong local transactional database for desktop POS deployments.

---

# 6. Mobile POS

For Expo/React Native:

```text
Expo
  │
  ▼
SQLite
  │
  ▼
Sync Engine
  │
  ▼
PostgreSQL
```

This is a good architecture for waiter/mobile POS applications.

---

# 7. Recommended Technology Stack

For a modern restaurant management system:

```text
Frontend
├── Next.js
├── React
├── Tailwind CSS
└── shadcn/ui

Mobile
└── Expo / React Native

Local Database
├── IndexedDB (Web)
└── SQLite (Mobile/Desktop)

Backend
├── API
├── Authentication
└── Sync Engine

Central Database
└── PostgreSQL

IDs
└── UUID / ULID
```

---

# 8. Restaurant Domain Modules

The database should be organized around business domains.

```text
Restaurant
│
├── Outlet
│   ├── Floors
│   ├── Tables
│   └── Kitchen Stations
│
├── Menu
│   ├── Categories
│   ├── Items
│   ├── Variants
│   ├── Modifiers
│   └── Recipes
│
├── Orders
│   ├── Orders
│   ├── Order Items
│   ├── KOT
│   ├── KOT Items
│   └── Payments
│
├── Kitchen
│   ├── Kitchen Stations
│   ├── KDS Tickets
│   ├── KDS Items
│   └── Preparation Status
│
├── Inventory
│   ├── Raw Materials
│   ├── Stock
│   ├── Purchases
│   ├── Consumption
│   └── Recipes
│
└── Sync
    ├── Sync Outbox
    ├── Sync Queue
    ├── Sync Cursor
    └── Conflict Resolution
```

---

# 9. KOT Architecture

KOT should not depend on the cloud.

### Bad Architecture

```text
POS
 ↓
Internet
 ↓
API
 ↓
PostgreSQL
 ↓
API
 ↓
KDS
```

If the internet goes down, the kitchen may stop receiving orders.

### Recommended Architecture

```text
POS
 ↓
Local Database
 ↓
Create KOT
 ↓
Local KDS Event
 ↓
KDS
```

The cloud synchronization happens independently.

```text
Local Database
      │
      ▼
  Sync Queue
      │
      ▼
 PostgreSQL
```

---

# 10. KOT Lifecycle

A KOT should be treated as a stateful business object.

```text
Order Created
      │
      ▼
KOT Created
      │
      ▼
Sent To Kitchen
      │
      ▼
KDS Received
      │
      ▼
Preparing
      │
      ▼
Ready
      │
      ▼
Completed
```

Possible states:

```text
DRAFT
SENT
RECEIVED
PREPARING
READY
COMPLETED
CANCELLED
```

---

# 11. KDS Architecture

KDS should maintain the current state as well as the event history.

### KDS Ticket

```text
kds_ticket

id
kot_id
station_id
status
priority
created_at
accepted_at
started_at
ready_at
completed_at
```

### KDS Events

```text
kds_events

id
ticket_id
event_type
device_id
created_at
metadata
```

Example events:

```text
KOT_CREATED
KOT_SENT
KDS_RECEIVED
PREPARING_STARTED
ITEM_READY
TICKET_READY
TICKET_COMPLETED
TICKET_CANCELLED
```

This gives you a reliable history of what happened in the kitchen.

---

# 12. Offline Sync

Use an **Outbox Pattern**.

Whenever an important action happens locally, save the business data and a sync event.

Example:

```text
Order Created
      │
      ├── orders
      ├── order_items
      ├── kot
      ├── kot_items
      │
      └── sync_outbox
```

Example `sync_outbox`:

```text
sync_outbox

id
device_id
entity_type
entity_id
operation
payload
created_at
synced_at
retry_count
```

Example:

```text
id: 10025
device_id: POS-01
entity_type: KOT
entity_id: KOT-83921
operation: CREATE
payload: {...}
created_at: ...
synced_at: NULL
```

When the internet becomes available:

```text
sync_outbox
     │
     ▼
 Sync Worker
     │
     ▼
    API
     │
     ▼
PostgreSQL
```

After successful synchronization:

```text
synced_at = current_timestamp
```

---

# 13. Use UUID / ULID

Do not depend entirely on auto-increment IDs for offline-created records.

### Avoid

```text
Order ID = 10001
```

Two devices working offline could potentially generate conflicting IDs.

### Prefer

```text
01K7M8Q9ABCD...
```

or UUID:

```text
550e8400-e29b-41d4-a716-446655440000
```

Each device can safely create records while offline.

---

# 14. Device Identity

Every POS/KDS device should have a unique identity.

```text
devices

id
device_id
outlet_id
device_type
name
last_sync_at
status
created_at
updated_at
```

Example:

```text
POS-01
POS-02
KDS-KITCHEN-01
KDS-BAR-01
WAITER-01
```

This is useful for:

* Offline synchronization
* Conflict resolution
* Audit logs
* Device management
* Troubleshooting
* User/device activity

---

# 15. Important Record Fields

For important offline-first entities, use fields such as:

```text
id
outlet_id
device_id
created_at
updated_at
version
deleted_at
```

For example:

```text
orders

id
outlet_id
device_id
table_id
customer_id
status
subtotal
discount
tax
total
created_at
updated_at
version
deleted_at
```

---

# 16. Soft Delete

Avoid physically deleting important business records.

Instead:

```text
deleted_at
```

Example:

```text
deleted_at = NULL
```

means active.

If deleted:

```text
deleted_at = 2026-09-15 16:30:00
```

This is especially important for synchronization.

Otherwise, another device may never know that a record was deleted.

---

# 17. Conflict Resolution

Offline-first systems must define what happens when two devices change the same record.

Example:

```text
POS-01
   │
   └── Order Item quantity = 2

POS-02
   │
   └── Order Item quantity = 3
```

The system needs a clear conflict strategy.

Possible approaches:

```text
Last Write Wins
        OR
Version Based
        OR
Event Based
        OR
Business Rule Based
```

For restaurant POS, **business-rule-based conflict resolution** is often better than blindly using last-write-wins.

For example:

```text
Payment
→ never silently overwrite

KOT
→ preserve kitchen events

Order item
→ use version/event history

Inventory
→ use stock transactions rather than overwriting quantity
```

---

# 18. Inventory Should Be Transaction-Based

For inventory, avoid simply doing:

```text
stock.quantity = 50
```

Instead maintain stock movements:

```text
stock_transactions

id
raw_material_id
transaction_type
quantity
reference_type
reference_id
created_at
device_id
```

Example:

```text
PURCHASE      +100
SALE           -5
WASTAGE        -2
ADJUSTMENT     +10
TRANSFER       -20
```

This is much safer for offline synchronization.

---

# 19. KOT + Inventory Relationship

When a food item is sold:

```text
Order
  │
  ▼
Order Item
  │
  ▼
KOT
  │
  ▼
Prepared
  │
  ▼
Recipe
  │
  ▼
Raw Material Consumption
```

For example:

```text
Chicken Biriyani
     │
     ├── Rice       250g
     ├── Chicken    150g
     ├── Oil         20ml
     └── Spices      10g
```

The system can create inventory consumption transactions from the recipe.

---

# 20. Multi-Device Restaurant Example

Imagine one outlet has:

```text
POS-01
POS-02
POS-03

KDS-KITCHEN
KDS-BAR

WAITER-01
WAITER-02
```

All devices can operate locally.

```text
                 OUTLET
                    │
       ┌────────────┼────────────┐
       │            │            │
     POS-01       POS-02       POS-03
       │            │            │
       └────────────┼────────────┘
                    │
              Local Sync
                    │
       ┌────────────┴────────────┐
       │                         │
 KDS-KITCHEN                 KDS-BAR
       │                         │
       └────────────┬────────────┘
                    │
               Internet
                    │
                    ▼
              PostgreSQL
```

---

# 21. Recommended Final Architecture

For your restaurant management system, I would use:

```text
┌─────────────────────────────────────────┐
│              FRONTEND                   │
│                                         │
│  Next.js Web POS / Admin / KDS          │
│  Expo Mobile POS                        │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           LOCAL DATA LAYER              │
│                                         │
│ Web       → IndexedDB                   │
│ Mobile    → SQLite                      │
│ Desktop   → SQLite                      │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│             SYNC ENGINE                 │
│                                         │
│ • Outbox                                │
│ • Retry Queue                           │
│ • Change Tracking                       │
│ • Conflict Resolution                   │
│ • Connectivity Detection                │
│ • Sync Cursor                           │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│                API                      │
│                                         │
│ Authentication                          │
│ Orders                                  │
│ KOT                                     │
│ KDS                                     │
│ Inventory                               │
│ Payments                                │
│ Sync                                    │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│             POSTGRESQL                  │
│                                         │
│ Central Source of Truth                 │
│                                         │
│ • Restaurant                            │
│ • Outlet                                │
│ • Menu                                  │
│ • Orders                                │
│ • KOT                                   │
│ • KDS                                   │
│ • Inventory                             │
│ • Payments                              │
│ • Users                                  │
│ • Audit Logs                            │
└─────────────────────────────────────────┘
```

---

# 22. Final Recommendation

For an **offline-first restaurant POS + KOT + KDS system**, the recommended architecture is:

```text
                    PostgreSQL
                         ▲
                         │
                    Sync Engine
                         ▲
              ┌──────────┴──────────┐
              │                     │
          IndexedDB              SQLite
              │                     │
           Web POS              Mobile/Desktop
              │                     │
              └──────────┬──────────┘
                         │
                    Local-first
                    Application
```

### Preferred stack

| Layer            | Technology                |
| ---------------- | ------------------------- |
| Web              | Next.js + React           |
| UI               | Tailwind + shadcn/ui      |
| Mobile           | Expo + React Native       |
| Web Local DB     | IndexedDB                 |
| Mobile Local DB  | SQLite                    |
| Desktop Local DB | SQLite                    |
| Central DB       | PostgreSQL                |
| API              | Next.js API / Backend     |
| Sync             | Custom bidirectional sync |
| IDs              | UUID / ULID               |
| Sync Pattern     | Outbox + Event Log        |
| Inventory        | Transaction-based         |
| KOT              | Local-first               |
| KDS              | Local-first               |
| Payments         | Event/transaction-based   |
| Audit            | Immutable event history   |

> **Key principle:** The restaurant should be able to run its POS, create KOTs, send tickets to KDS, update kitchen status, and continue operations even when the internet is completely unavailable. PostgreSQL should synchronize the data rather than being required for every POS operation.
