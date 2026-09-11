# ADR-0007: Customer records with multi-address and order linkage

Date: 2026-09-11 · Status: accepted

## Context

Orders carry flat `customer_name/phone` snapshots but no customer entity.
Reference parity (Odoo contacts with typed addresses, Zoho compound address +
lat/long + alternates, Petpooja CRM pools + labels, Rista customer data)
requires first-class records ready for website orders (geo + multi-address).

## Decisions

1. **Customer entity** (`cus_*`, outlet-scoped, phone-unique per outlet,
   soft-delete). Free-text tags (Petpooja-labels style), notes, no loyalty
   fields — loyalty/wallet explicitly deferred.
2. **Multi-address now.** `addresses[]` with `home|work|other` labels, exactly
   one `is_primary` (service-enforced), full structured fields plus optional
   `latitude/longitude` manual entry — schema-ready for website geo; map UI
   deferred.
3. **Order linkage without history rewrites.** `customer_id?` on the order;
   `linkCustomer` snapshots name/phone (immutable history, outlet-checked,
   blocked on terminal states). Workspace shows linked chip → customer detail
   (or phone lookup → attach when unlinked). Customer detail shows order
   history + lifetime paise stats derived from the orders read-model (dynamic
   import — orders/service already imports customers/service).
4. **Audit** via new `CUSTOMER_CREATED/UPDATED/DELETED` + `ORDER_CUSTOMER_LINKED`
   events (workflows list extended).

## Consequences

- Website orders later can post addresses with geo into the same shape.
- Delete is plain soft-delete; open-order guard deferred until payments land
  (orders only reference customers by snapshot + id, never cascade).
