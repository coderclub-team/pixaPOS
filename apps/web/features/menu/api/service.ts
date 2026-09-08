import { delay } from "@/constants/mock-api";
import type {
  MenuCategory,
  MenuCategoryFilters,
  MenuCategoryPayload,
  MenuItem,
  MenuItemFilters,
  MenuItemPayload,
} from "./types";

let mockCategories: MenuCategory[] = [
  {
    id: "mc_001",
    name: "Starters",
    slug: "starters",
    sort_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mc_002",
    name: "Biryani",
    slug: "biryani",
    sort_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mc_003",
    name: "Beverages",
    slug: "beverages",
    sort_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mc_004",
    name: "Main Course",
    slug: "main-course",
    sort_order: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockMenuItems: MenuItem[] = [
  {
    id: "mi_001",
    name: "Chicken Biryani",
    slug: "chicken-biryani",
    category_id: "mc_002",
    category_name: "Biryani",
    description: "Hyderabadi dum biryani",
    veg_type: "nonveg",
    taxable: true,
    tax_type: "GST",
    tax_percent: 5,
    hsn_code: "21069030",
    available_channels: ["dine_in", "pickup", "delivery"],
    variants: [
      {
        id: "mv_001",
        menu_item_id: "mi_001",
        name: "Half",
        sku: "BIRY-CB-HALF",
        selling_price: 199,
        qty: 500,
        unit: "gr",
        is_default: true,
        is_active: true,
      },
      {
        id: "mv_002",
        menu_item_id: "mi_001",
        name: "Full",
        sku: "BIRY-CB-FULL",
        selling_price: 349,
        qty: 1000,
        unit: "gr",
        is_active: true,
      },
    ],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mi_002",
    name: "Cold Coffee",
    slug: "cold-coffee",
    category_id: "mc_003",
    category_name: "Beverages",
    veg_type: "veg",
    taxable: false,
    available_channels: ["dine_in", "delivery", "zomato"],
    variants: [
      {
        id: "mv_003",
        menu_item_id: "mi_002",
        name: "250ml",
        sku: "BEV-CC-250",
        label: "250ml",
        qty: 250,
        unit: "ml",
        selling_price: 99,
        is_default: true,
        is_active: true,
      },
      {
        id: "mv_004",
        menu_item_id: "mi_002",
        name: "500ml",
        sku: "BEV-CC-500",
        label: "500ml",
        qty: 500,
        unit: "ml",
        selling_price: 159,
        is_active: true,
      },
    ],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Categories
export async function getMenuCategories(filters?: MenuCategoryFilters): Promise<MenuCategory[]> {
  await delay(300);
  let r = [...mockCategories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q));
  }
  if (filters?.is_active !== undefined) r = r.filter((c) => c.is_active === filters.is_active);
  return r;
}
export async function getMenuCategoryById(id: string): Promise<MenuCategory | null> {
  await delay(200);
  return mockCategories.find((c) => c.id === id) ?? null;
}
export async function createMenuCategory(payload: MenuCategoryPayload): Promise<MenuCategory> {
  await delay(500);
  if (mockCategories.some((c) => c.name.toLowerCase() === payload.name.toLowerCase()))
    throw new Error("Category already exists");
  const now = new Date().toISOString();
  const cat: MenuCategory = {
    id: `mc_${Date.now().toString(36)}`,
    name: payload.name,
    slug: (payload as any).slug ?? slugify(payload.name),
    description: (payload as any).description,
    image_url: undefined, // placeholder this phase, not stored even if passed
    parent_id: (payload as any).parent_id,
    sort_order: payload.sort_order ?? mockCategories.length + 1,
    is_active: payload.is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockCategories.push(cat);
  return { ...cat };
}
export async function updateMenuCategory(
  id: string,
  payload: MenuCategoryPayload,
): Promise<MenuCategory> {
  await delay(500);
  const idx = mockCategories.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Category not found");
  mockCategories[idx] = {
    ...mockCategories[idx],
    ...payload,
    slug: (payload as any).slug ?? mockCategories[idx].slug,
    image_url: (payload as any).image_url ?? mockCategories[idx].image_url,
    updated_at: new Date().toISOString(),
  };
  return { ...mockCategories[idx] };
}
export async function deleteMenuCategory(id: string): Promise<void> {
  await delay(400);
  const idx = mockCategories.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Category not found");
  if (mockMenuItems.some((m) => m.category_id === id))
    throw new Error("Category in use by menu items");
  if (mockCategories.some((c) => c.parent_id === id))
    throw new Error("Category has sub-categories");
  mockCategories.splice(idx, 1);
}

// Menu Items
export async function getMenuItems(filters?: MenuItemFilters): Promise<MenuItem[]> {
  await delay(400);
  let r = [...mockMenuItems].sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.slug.includes(q) ||
        m.variants.some((v) => v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)),
    );
  }
  if (filters?.category_id) r = r.filter((m) => m.category_id === filters.category_id);
  if (filters?.veg_type) r = r.filter((m) => m.veg_type === filters.veg_type);
  if (filters?.channel) r = r.filter((m) => m.available_channels.includes(filters.channel!));
  if (filters?.is_active !== undefined) r = r.filter((m) => m.is_active === filters.is_active);
  return r;
}
export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  await delay(300);
  return mockMenuItems.find((m) => m.id === id) ?? null;
}
export async function createMenuItem(payload: MenuItemPayload): Promise<MenuItem> {
  await delay(600);
  if (payload.variants && payload.variants.length > 0) {
    const skus = payload.variants.map((v) => (v.sku ?? "").toLowerCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) throw new Error("Variant SKU duplicate");
    if (
      skus.some((s) =>
        mockMenuItems.flatMap((m) => m.variants).some((v) => v.sku.toLowerCase() === s),
      )
    )
      throw new Error("SKU already exists");
  }
  if (payload.hsn_code && !/^[0-9]{4,8}$/.test(payload.hsn_code))
    throw new Error("Invalid HSN 4-8 digits");
  const now = new Date().toISOString();
  const slug = (payload as any).slug ?? slugify(payload.name);
  if (mockMenuItems.some((m) => m.slug === slug)) throw new Error("Slug already exists");
  const cat = mockCategories.find((c) => c.id === payload.category_id);
  const id = `mi_${Date.now().toString(36)}`;
  const variants = (
    payload.variants ?? [
      { name: "Regular", sku: `${slug.toUpperCase()}-REG`, selling_price: 0, is_active: true },
    ]
  ).map((v: any, idx: number) => ({
    id: v.id ?? `mv_${Date.now().toString(36)}_${idx}`,
    menu_item_id: id,
    name: v.name ?? "Regular",
    sku: (v.sku ?? `${slug.toUpperCase()}-${String(idx + 1).padStart(3, "0")}`).toUpperCase(),
    barcode: v.barcode,
    label: v.label,
    qty: v.qty,
    unit: v.unit,
    selling_price: Number(v.selling_price ?? 0),
    compare_price: v.compare_price,
    recipe_id: v.recipe_id,
    is_default: v.is_default ?? idx === 0,
    is_active: v.is_active ?? true,
  }));
  const item: MenuItem = {
    id,
    name: payload.name,
    slug,
    category_id: payload.category_id,
    category_name: cat?.name,
    description: (payload as any).description,
    image_url: undefined, // placeholder not used this phase
    veg_type: (payload as any).veg_type ?? "veg",
    spice_level: (payload as any).spice_level,
    prep_time_min: (payload as any).prep_time_min,
    allergens: (payload as any).allergens,
    taxable: (payload as any).taxable ?? false,
    tax_type: (payload as any).tax_type,
    tax_percent: (payload as any).tax_percent,
    hsn_code: (payload as any).hsn_code,
    available_channels: (payload as any).available_channels ?? ["dine_in", "pickup", "delivery"],
    variants,
    is_active: (payload as any).is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockMenuItems.push(item);
  return { ...item };
}
export async function updateMenuItem(id: string, payload: MenuItemPayload): Promise<MenuItem> {
  await delay(600);
  const idx = mockMenuItems.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Menu item not found");
  const current = mockMenuItems[idx];
  const cat = payload.category_id
    ? mockCategories.find((c) => c.id === payload.category_id)
    : undefined;
  let variants = current.variants;
  if (payload.variants) {
    variants = (payload.variants as any).map((v: any, vidx: number) => ({
      id: v.id ?? `mv_${Date.now().toString(36)}_${vidx}`,
      menu_item_id: id,
      name: v.name ?? "Regular",
      sku: (v.sku ?? `SKU-${vidx}`).toUpperCase(),
      barcode: v.barcode,
      label: v.label,
      qty: v.qty,
      unit: v.unit,
      selling_price: Number(v.selling_price ?? 0),
      compare_price: v.compare_price,
      recipe_id: v.recipe_id,
      is_default: v.is_default ?? vidx === 0,
      is_active: v.is_active ?? true,
    }));
  }
  const updated: MenuItem = {
    ...current,
    ...payload,
    slug: (payload as any).slug ?? current.slug,
    category_name: cat?.name ?? current.category_name,
    variants,
    updated_at: new Date().toISOString(),
  };
  mockMenuItems[idx] = updated;
  return { ...updated };
}
export async function deleteMenuItem(id: string): Promise<void> {
  await delay(400);
  const idx = mockMenuItems.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Menu item not found");
  mockMenuItems.splice(idx, 1);
}
