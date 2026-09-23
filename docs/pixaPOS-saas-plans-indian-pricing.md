# pixaPOS SaaS Plans — Indian Pricing

> Status: **PARKED DRAFT — do not implement.** Prices below are structural
> placeholders (`₹X`/`₹Y`); fill real numbers before any billing build.
> Pricing model follows the adopted rule: **base Workspace plan + per-outlet
> charges** (`docs/architecture/multi-workspace-multi-outlet.md` §12).

## Model

```text
Base Workspace Plan (includes 1 outlet)
+ Additional Outlet × N
+ Optional Add-ons
```

## Plans (draft)

| Plan | Monthly | Outlets included | Target |
|---|---|---|---|
| Starter | ₹X | 1 | Single QSR / cafe, billing + KOT only |
| Growth | ₹Y | 1 | Full POS: inventory, KDS, online ordering |
| Enterprise | Custom | Unlimited | Chains, franchises, API + onboarding |

Additional outlet past the included one: ₹Z / outlet / month (all plans).

## Billing rules (already true in code)

- One subscription per **organization** (`features/billing`, ADR-0021 gap 3 fixed).
- 14-day trial from org creation, 3-day grace, then blocked.
- GST 18% applied at invoice render on the tax-exclusive price
  (**confirm with CA before go-live** — already flagged in `billing/api/types.ts`).
- Razorpay: test keys on dev/stage, LIVE keys on prod only (still pending swap).

## Open pricing questions (need owner decisions)

1. Real values for X / Y / Z (anchor against Petpooja/TMBill/Rista parity work in `plan.md`).
2. Annual billing? Discount %?
3. Add-ons priced: extra devices, SMS/WhatsApp eBill credits, KDS screens?
4. Outlet limit enforcement point (block new outlet vs warn)?
5. Migration: existing trial users when prices publish?

## Do-not-touch list (until unparked)

- `features/billing/api/types.ts` plan constants
- Razorpay dashboard plan IDs / `RAZORPAY_PLAN_ID`
- Subscribe route, webhook reconcile, invoice render
