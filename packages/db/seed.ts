/**
 * Seed parity rows so a fresh Neon branch matches the local mocks:
 * outlet out_001, floor fl_001, table tbl_001. Idempotent (on-conflict ignore).
 * Usage: DATABASE_URL=... pnpm --filter @pixa/db seed
 */
import { db } from "./index";
import { floors, tables } from "./schema";
import { saasPlans } from "./saas-schema";
import { DEFAULT_PLANS } from "./plans";

async function main() {
  const database = db();
  // Default subscription plans (Starter/Growth/Custom). Fully upserted so the
  // seed is the source of truth for launch pricing/limits/flags. Run manually.
  for (const p of DEFAULT_PLANS) {
    const values = {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      monthlyPaise: p.monthlyPaise,
      annualDiscountPct: p.annualDiscountPct,
      features: JSON.stringify(p.features),
      limits: JSON.stringify(p.limits),
      flags: JSON.stringify(p.flags),
      outletLimit: p.limits.outlets,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    };
    await database
      .insert(saasPlans)
      .values(values)
      .onConflictDoUpdate({ target: saasPlans.id, set: values });
  }
  await database
    .insert(floors)
    .values({
      id: "fl_001",
      outletId: "out_001",
      name: "Ground Floor",
      code: "GF",
      level: 0,
      capacity: 40,
      sortOrder: 0,
      isActive: true,
    })
    .onConflictDoNothing({ target: floors.id });
  await database
    .insert(tables)
    .values({
      id: "tbl_001",
      outletId: "out_001",
      floorId: "fl_001",
      number: "T1",
      code: "TBL-101",
      capacity: 4,
      shape: "square",
      type: "standard",
      allowsSharing: false,
      status: "available",
      isActive: true,
      sortOrder: 0,
      xMm: 1000,
      yMm: 1000,
      wMm: 900,
      hMm: 900,
      rotationDeg: 0,
      zIndex: 0,
    })
    .onConflictDoNothing({ target: tables.id });
  console.log("seed ok: out_001 / fl_001 / tbl_001");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
