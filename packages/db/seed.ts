/**
 * Dev seed: outlet + shared masters (suppliers, raw materials, recipes,
 * categories, items, variants, modifiers) + SaaS plans + floor/table parity.
 *
 * Best-practice rules:
 * - IDEMPOTENT: every insert is upsert-or-ignore on stable `seed_*` ids.
 *   Safe to re-run; never wipes.
 * - SCOPED: requires SEED_ORG_ID (never guess an org). Outlet code via
 *   SEED_OUTLET_CODE (default "MAIN").
 * - NO fake transactions: orders/KOTs/payments are never seeded (audit).
 * - DEV ONLY: run with the dev branch DATABASE_URL.
 *
 * Usage:
 *   SEED_ORG_ID=org_xxx [SEED_OUTLET_CODE=MAIN] DATABASE_URL=... pnpm --filter @pixa/db seed
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  floors,
  tables,
  outlets,
  outletKitchenStations,
  suppliers,
  rawMaterials,
  recipes,
  recipeIngredients,
  menuCategories,
  menuItems,
  menuVariants,
  modifierGroups,
  modifiers,
  purchaseOrders,
  purchaseOrderItems,
  purchases,
  purchaseItems,
} from "./schema";
import { saasPlans } from "./saas-schema";
import { DEFAULT_PLANS } from "./plans";

const ORG = process.env.SEED_ORG_ID ?? "";
const OUTLET_CODE = (process.env.SEED_OUTLET_CODE ?? "MAIN").trim().toUpperCase() || "MAIN";

if (!ORG) {
  console.error("SEED_ORG_ID is required (refusing to seed into an unknown org)");
  process.exit(1);
}

async function main() {
  const database = db();
  const now = new Date();
  const base = { organizationId: ORG, isActive: true, createdAt: now, updatedAt: now };

  // SaaS plans (source of truth for launch pricing/limits/flags).
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

  // Master outlet + stations.
  const desiredOutletId = `seed_outlet_${OUTLET_CODE.toLowerCase()}`;
  await database
    .insert(outlets)
    .values({
      id: desiredOutletId,
      organizationId: ORG,
      name: "Main Outlet",
      code: OUTLET_CODE,
      currency: "INR",
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      settings: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  const [existingOutlet] = await database
    .select({ id: outlets.id, organizationId: outlets.organizationId })
    .from(outlets)
    .where(eq(outlets.code, OUTLET_CODE))
    .limit(1);
  if (!existingOutlet) {
    throw new Error(`Failed to create or find outlet with code "${OUTLET_CODE}"`);
  }
  if (existingOutlet.organizationId !== ORG) {
    throw new Error(
      `Outlet code "${OUTLET_CODE}" belongs to org "${existingOutlet.organizationId}", not "${ORG}"`,
    );
  }
  const outletId = existingOutlet.id;
  for (const [i, s] of [
    { name: "Main Kitchen", code: "KITCHEN" },
    { name: "Bar", code: "BAR" },
  ].entries()) {
    await database
      .insert(outletKitchenStations)
      .values({
        id: `seed_station_${outletId}_${s.code.toLowerCase()}`,
        organizationId: ORG,
        outletId,
        name: s.name,
        code: s.code,
        displayOrder: i,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  // Suppliers.
  const sups = [
    { id: "seed_sup_veg", name: "FreshVeg Traders", phone: "+919820011122" },
    { id: "seed_sup_dairy", name: "Amul Dairy Route", phone: "+919820033344" },
    { id: "seed_sup_poultry", name: "Suguna Poultry", phone: "+919820055566" },
    { id: "seed_sup_dry", name: "Metro Dry Goods", phone: "+919820077788" },
  ];
  for (const s of sups) {
    await database
      .insert(suppliers)
      .values({ ...base, ...s })
      .onConflictDoNothing({ target: suppliers.id });
  }

  // Raw materials.
  const mats: { id: string; name: string; sku: string; unit: string; supplierId: string }[] = [
    {
      id: "seed_rm_paneer",
      name: "Paneer",
      sku: "RM-PANEER",
      unit: "kg",
      supplierId: "seed_sup_dairy",
    },
    { id: "seed_rm_milk", name: "Milk", sku: "RM-MILK", unit: "l", supplierId: "seed_sup_dairy" },
    {
      id: "seed_rm_butter",
      name: "Butter",
      sku: "RM-BUTTER",
      unit: "kg",
      supplierId: "seed_sup_dairy",
    },
    {
      id: "seed_rm_cheese",
      name: "Cheese",
      sku: "RM-CHEESE",
      unit: "kg",
      supplierId: "seed_sup_dairy",
    },
    {
      id: "seed_rm_chicken",
      name: "Chicken",
      sku: "RM-CHICKEN",
      unit: "kg",
      supplierId: "seed_sup_poultry",
    },
    {
      id: "seed_rm_rice",
      name: "Basmati Rice",
      sku: "RM-RICE",
      unit: "kg",
      supplierId: "seed_sup_dry",
    },
    {
      id: "seed_rm_flour",
      name: "Wheat Flour",
      sku: "RM-FLOUR",
      unit: "kg",
      supplierId: "seed_sup_dry",
    },
    { id: "seed_rm_sugar", name: "Sugar", sku: "RM-SUGAR", unit: "kg", supplierId: "seed_sup_dry" },
    {
      id: "seed_rm_coffee",
      name: "Coffee Beans",
      sku: "RM-COFFEE",
      unit: "kg",
      supplierId: "seed_sup_dry",
    },
    {
      id: "seed_rm_tomato",
      name: "Tomato",
      sku: "RM-TOMATO",
      unit: "kg",
      supplierId: "seed_sup_veg",
    },
    { id: "seed_rm_onion", name: "Onion", sku: "RM-ONION", unit: "kg", supplierId: "seed_sup_veg" },
    {
      id: "seed_rm_spices",
      name: "Garam Masala",
      sku: "RM-SPICES",
      unit: "g",
      supplierId: "seed_sup_dry",
    },
  ];
  for (const m of mats) {
    await database
      .insert(rawMaterials)
      .values({ ...base, ...m, taxPercent: 0 })
      .onConflictDoNothing({ target: rawMaterials.id });
  }

  // Recipes + ingredients.
  const recs: {
    id: string;
    name: string;
    yields: string;
    ingredients: { materialId: string; qty: number; unit: string }[];
  }[] = [
    {
      id: "seed_rec_pbm",
      name: "Paneer Butter Masala",
      yields: "4 serves",
      ingredients: [
        { materialId: "seed_rm_paneer", qty: 500, unit: "g" },
        { materialId: "seed_rm_tomato", qty: 300, unit: "g" },
        { materialId: "seed_rm_butter", qty: 50, unit: "g" },
        { materialId: "seed_rm_spices", qty: 10, unit: "g" },
      ],
    },
    {
      id: "seed_rec_biryani",
      name: "Chicken Biryani",
      yields: "4 serves",
      ingredients: [
        { materialId: "seed_rm_chicken", qty: 750, unit: "g" },
        { materialId: "seed_rm_rice", qty: 500, unit: "g" },
        { materialId: "seed_rm_onion", qty: 200, unit: "g" },
        { materialId: "seed_rm_spices", qty: 15, unit: "g" },
      ],
    },
    {
      id: "seed_rec_coffee",
      name: "Cold Coffee",
      yields: "2 serves",
      ingredients: [
        { materialId: "seed_rm_milk", qty: 400, unit: "ml" },
        { materialId: "seed_rm_coffee", qty: 30, unit: "g" },
        { materialId: "seed_rm_sugar", qty: 40, unit: "g" },
      ],
    },
    {
      id: "seed_rec_friedrice",
      name: "Veg Fried Rice",
      yields: "2 serves",
      ingredients: [
        { materialId: "seed_rm_rice", qty: 300, unit: "g" },
        { materialId: "seed_rm_onion", qty: 100, unit: "g" },
        { materialId: "seed_rm_tomato", qty: 100, unit: "g" },
      ],
    },
  ];
  for (const r of recs) {
    await database
      .insert(recipes)
      .values({ ...base, id: r.id, name: r.name, yields: r.yields })
      .onConflictDoNothing({ target: recipes.id });
    for (const [i, ing] of r.ingredients.entries()) {
      await database
        .insert(recipeIngredients)
        .values({
          id: `seed_ri_${r.id}_${i}`,
          organizationId: ORG,
          recipeId: r.id,
          materialId: ing.materialId,
          qty: ing.qty,
          unit: ing.unit,
        })
        .onConflictDoNothing({ target: recipeIngredients.id });
    }
  }

  // Categories.
  const cats = [
    { id: "seed_cat_starters", name: "Starters", slug: "starters", sortOrder: 0 },
    { id: "seed_cat_mains", name: "Mains", slug: "mains", sortOrder: 1 },
    { id: "seed_cat_rice", name: "Biryani & Rice", slug: "biryani-rice", sortOrder: 2 },
    { id: "seed_cat_beverages", name: "Beverages", slug: "beverages", sortOrder: 3 },
  ];
  for (const c of cats) {
    await database
      .insert(menuCategories)
      .values({ ...base, ...c })
      .onConflictDoNothing({ target: menuCategories.id });
  }

  // Modifier groups + modifiers.
  const groups = [
    {
      id: "seed_mg_spice",
      name: "Spice Level",
      selectionType: "single",
      minSelection: 0,
      maxSelection: 1,
    },
    {
      id: "seed_mg_addon",
      name: "Add-ons",
      selectionType: "multiple",
      minSelection: 0,
      maxSelection: 3,
    },
  ];
  for (const g of groups) {
    await database
      .insert(modifierGroups)
      .values({ ...base, ...g })
      .onConflictDoNothing({ target: modifierGroups.id });
  }
  const mods = [
    { id: "seed_mod_mild", groupId: "seed_mg_spice", name: "Mild", price: 0, sortOrder: 0 },
    { id: "seed_mod_medium", groupId: "seed_mg_spice", name: "Medium", price: 0, sortOrder: 1 },
    { id: "seed_mod_hot", groupId: "seed_mg_spice", name: "Extra Hot", price: 0, sortOrder: 2 },
    {
      id: "seed_mod_cheese",
      groupId: "seed_mg_addon",
      name: "Extra Cheese",
      price: 4000,
      sortOrder: 0,
    },
    {
      id: "seed_mod_paneer",
      groupId: "seed_mg_addon",
      name: "Extra Paneer",
      price: 6000,
      sortOrder: 1,
    },
  ];
  for (const m of mods) {
    await database
      .insert(modifiers)
      .values({ ...base, ...m })
      .onConflictDoNothing({ target: modifiers.id });
  }

  // Items + variants (prices in paise).
  const items: {
    id: string;
    name: string;
    categoryId: string;
    groups: string[];
    tax: number;
    variants: {
      id: string;
      name: string;
      sku: string;
      price: number;
      recipe?: string;
      dflt?: boolean;
    }[];
  }[] = [
    {
      id: "seed_item_pbm",
      name: "Paneer Butter Masala",
      categoryId: "seed_cat_mains",
      groups: ["seed_mg_spice"],
      tax: 5,
      variants: [
        {
          id: "seed_var_pbm",
          name: "Regular",
          sku: "PBM-REG",
          price: 24000,
          recipe: "seed_rec_pbm",
          dflt: true,
        },
      ],
    },
    {
      id: "seed_item_biryani",
      name: "Chicken Biryani",
      categoryId: "seed_cat_rice",
      groups: ["seed_mg_spice", "seed_mg_addon"],
      tax: 5,
      variants: [
        {
          id: "seed_var_bir_half",
          name: "Half",
          sku: "BIR-HALF",
          price: 16000,
          recipe: "seed_rec_biryani",
        },
        {
          id: "seed_var_bir_full",
          name: "Full",
          sku: "BIR-FULL",
          price: 26000,
          recipe: "seed_rec_biryani",
          dflt: true,
        },
      ],
    },
    {
      id: "seed_item_friedrice",
      name: "Veg Fried Rice",
      categoryId: "seed_cat_rice",
      groups: ["seed_mg_addon"],
      tax: 5,
      variants: [
        {
          id: "seed_var_fr",
          name: "Regular",
          sku: "VFR-REG",
          price: 18000,
          recipe: "seed_rec_friedrice",
          dflt: true,
        },
      ],
    },
    {
      id: "seed_item_coffee",
      name: "Cold Coffee",
      categoryId: "seed_cat_beverages",
      groups: [],
      tax: 5,
      variants: [
        {
          id: "seed_var_cof_s",
          name: "Small",
          sku: "CC-S",
          price: 12000,
          recipe: "seed_rec_coffee",
        },
        {
          id: "seed_var_cof_l",
          name: "Large",
          sku: "CC-L",
          price: 16000,
          recipe: "seed_rec_coffee",
          dflt: true,
        },
      ],
    },
    {
      id: "seed_item_pakora",
      name: "Paneer Pakora",
      categoryId: "seed_cat_starters",
      groups: ["seed_mg_spice"],
      tax: 5,
      variants: [{ id: "seed_var_pak", name: "8 pc", sku: "PP-8PC", price: 14000, dflt: true }],
    },
  ];
  for (const item of items) {
    await database
      .insert(menuItems)
      .values({
        ...base,
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        productType: item.variants.length > 1 ? "variant" : "simple",
        itemType: "goods",
        taxable: true,
        taxPercent: item.tax,
        modifierGroupIds: item.groups,
      })
      .onConflictDoNothing({ target: menuItems.id });
    for (const v of item.variants) {
      await database
        .insert(menuVariants)
        .values({
          ...base,
          id: v.id,
          name: v.name,
          menuItemId: item.id,
          sku: v.sku,
          sellingPrice: v.price,
          recipeId: v.recipe,
          isDefault: v.dflt ?? false,
        })
        .onConflictDoNothing({ target: menuVariants.id });
    }
  }
  // Link recipes back to items.
  await database
    .insert(recipes)
    .values({
      ...base,
      id: "seed_rec_pbm",
      name: "Paneer Butter Masala",
      yields: "4 serves",
      menuItemId: "seed_item_pbm",
    })
    .onConflictDoUpdate({ target: recipes.id, set: { menuItemId: "seed_item_pbm" } });
  await database
    .insert(recipes)
    .values({
      ...base,
      id: "seed_rec_biryani",
      name: "Chicken Biryani",
      yields: "4 serves",
      menuItemId: "seed_item_biryani",
    })
    .onConflictDoUpdate({ target: recipes.id, set: { menuItemId: "seed_item_biryani" } });
  await database
    .insert(recipes)
    .values({
      ...base,
      id: "seed_rec_coffee",
      name: "Cold Coffee",
      yields: "2 serves",
      menuItemId: "seed_item_coffee",
    })
    .onConflictDoUpdate({ target: recipes.id, set: { menuItemId: "seed_item_coffee" } });
  await database
    .insert(recipes)
    .values({
      ...base,
      id: "seed_rec_friedrice",
      name: "Veg Fried Rice",
      yields: "2 serves",
      menuItemId: "seed_item_friedrice",
    })
    .onConflictDoUpdate({ target: recipes.id, set: { menuItemId: "seed_item_friedrice" } });

  // Floor/table starter rows (org-scoped ids — global fl_001/tbl_001
  // belong to the legacy mock outlet and must not be reused).
  const floorId = `seed_floor_${OUTLET_CODE.toLowerCase()}`;
  await database
    .insert(floors)
    .values({
      id: floorId,
      organizationId: ORG,
      outletId,
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
      id: `seed_table_${OUTLET_CODE.toLowerCase()}_01`,
      organizationId: ORG,
      outletId,
      floorId: floorId,
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

  // Purchase orders + purchases (outlet-owned, paise).
  const pos: {
    id: string;
    no: string;
    supplier: string;
    status: string;
    items: { id: string; material: string; qty: number; unit: string; cost: number }[];
  }[] = [
    {
      id: "seed_po_01",
      no: "PO-2025-001",
      supplier: "seed_sup_dry",
      status: "received",
      items: [
        { id: "seed_poi_01", material: "seed_rm_rice", qty: 50, unit: "kg", cost: 6500 },
        { id: "seed_poi_02", material: "seed_rm_sugar", qty: 25, unit: "kg", cost: 4200 },
        { id: "seed_poi_03", material: "seed_rm_coffee", qty: 5, unit: "kg", cost: 85000 },
      ],
    },
    {
      id: "seed_po_02",
      no: "PO-2025-002",
      supplier: "seed_sup_dairy",
      status: "draft",
      items: [
        { id: "seed_poi_04", material: "seed_rm_paneer", qty: 10, unit: "kg", cost: 32000 },
        { id: "seed_poi_05", material: "seed_rm_butter", qty: 5, unit: "kg", cost: 55000 },
      ],
    },
  ];
  for (const po of pos) {
    const sub = po.items.reduce((s, i) => s + i.qty * i.cost, 0);
    const tax = Math.round(sub * 0.05);
    await database
      .insert(purchaseOrders)
      .values({
        id: po.id,
        organizationId: ORG,
        outletId,
        poNumber: po.no,
        supplierId: po.supplier,
        status: po.status,
        subtotalPaise: sub,
        taxPaise: tax,
        totalPaise: sub + tax,
        poDate: "2025-01-15",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: purchaseOrders.id });
    for (const i of po.items) {
      await database
        .insert(purchaseOrderItems)
        .values({
          id: i.id,
          organizationId: ORG,
          purchaseOrderId: po.id,
          materialId: i.material,
          qty: i.qty,
          unit: i.unit,
          unitCostPaise: i.cost,
          taxPercent: 5,
        })
        .onConflictDoNothing({ target: purchaseOrderItems.id });
    }
  }
  const purs: {
    id: string;
    no: string;
    po?: string;
    supplier: string;
    paid: number;
    status: string;
    mode?: string;
    items: {
      id: string;
      material: string;
      qty: number;
      unit: string;
      cost: number;
      batch?: string;
    }[];
  }[] = [
    {
      id: "seed_pur_01",
      no: "PUR-2025-001",
      po: "seed_po_01",
      supplier: "seed_sup_dry",
      paid: 200000,
      status: "partial",
      mode: "upi",
      items: [
        {
          id: "seed_pi_01",
          material: "seed_rm_rice",
          qty: 50,
          unit: "kg",
          cost: 6500,
          batch: "B-RICE-01",
        },
        {
          id: "seed_pi_02",
          material: "seed_rm_sugar",
          qty: 25,
          unit: "kg",
          cost: 4200,
          batch: "B-SUGAR-01",
        },
      ],
    },
    {
      id: "seed_pur_02",
      no: "PUR-2025-002",
      supplier: "seed_sup_veg",
      paid: 0,
      status: "unpaid",
      items: [
        { id: "seed_pi_03", material: "seed_rm_tomato", qty: 20, unit: "kg", cost: 3000 },
        { id: "seed_pi_04", material: "seed_rm_onion", qty: 25, unit: "kg", cost: 2800 },
      ],
    },
  ];
  for (const pu of purs) {
    const sub = pu.items.reduce((s, i) => s + i.qty * i.cost, 0);
    const tax = Math.round(sub * 0.05);
    await database
      .insert(purchases)
      .values({
        id: pu.id,
        organizationId: ORG,
        outletId,
        purchaseNumber: pu.no,
        purchaseOrderId: pu.po,
        supplierId: pu.supplier,
        subtotalPaise: sub,
        taxPaise: tax,
        landedPaise: 0,
        totalPaise: sub + tax,
        paidPaise: pu.paid,
        paymentStatus: pu.status,
        paymentMode: pu.mode,
        billDate: "2025-01-16",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: purchases.id });
    for (const i of pu.items) {
      await database
        .insert(purchaseItems)
        .values({
          id: i.id,
          organizationId: ORG,
          purchaseId: pu.id,
          materialId: i.material,
          qty: i.qty,
          unit: i.unit,
          unitCostPaise: i.cost,
          batchNo: i.batch,
        })
        .onConflictDoNothing({ target: purchaseItems.id });
    }
  }

  console.log(`seed ok: org=${ORG} outlet=${OUTLET_CODE} (${outletId})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
