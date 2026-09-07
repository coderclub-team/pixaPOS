# Plan — pixaPOS Restaurant Reference Rule

**Always inspect before implementing:** Muse Spark must cross-check **Odoo (Inventory + POS Restaurant), Zoho (Inventory + Books), Petpooja, TMBill** for every feature plan.

## When
- Any new `features/menu`, `features/inventory`, `features/outlet`, `features/orders`, `features/payments`, `nav-config`, or `suppliers/ledger` change.
- Even for small UI: table columns, form fields, nav grouping, status flows.

## How
1. **Delegate `explore` agents** to read current `types.ts/service.ts/queries.ts/components/page.tsx/nav-config.ts` (verify `apps/web/...` line numbers).
2. **`websearch` (live crawl preferred)** for Odoo docs (`odoo.com/documentation/.../products_prices`, `point-of-sale-restaurant`), Zoho docs (`zoho.com/inventory/help/items`, `zoho.com/books/help/settings/organization-profile`), Petpooja help (`petpooja.com` menu/inventory docs), TMBill docs/help.
3. **Synthesize comparison table** Odoo | Zoho | Petpooja | TMBill | pixaPOS Gap.
4. **Draft plan** with `Current debt`, `Odoo/Zoho/Petpooja/TMBill parity gaps`, `Proposed entities/types/pages/nav`, `File map (6-8 files)`, `Questions before build`.

## Reference Models to Reuse
- Odoo: `Product Template → Attributes → Variants` + `POS Category` visibility + `Pricelist` per channel + `Branches` for Outlet + `Stock Moves` balance.
- Zoho: `Item Groups` (auto SKU) + `Modifier Groups min/max` + `Organization Profile` single page tabs + `Vendor Credits / Payments Made`.
- Petpooja: Menu `Category → Dish → Variants (Half/Full, 250ml)` + `Addons` + `Kitchen Station` + `Outlet floors/tables`.
- TMBill: Simple restaurant `Menu → Price → Variant (Small/Large)`, `Dine-in/Pickup/Delivery` channel flags, `Daily Reports`.

## Non-Negotiable
- Never skip reference check — even if user says "proceed with your suggestion", still verify 4 apps.
- Keep plan concise, `file_path:line` cited, tradeoffs asked (e.g., `Variant per-recipe link?` / `Channel single menu vs duplicate?`).
- Store plan here (`plan.md`) so user never repeats instruction.
