import { delay } from "@/constants/mock-api";
import { MENU_SEED_VERSION, seedCategories, seedMenuItems } from "./seed-data";
import type {
  MenuCategory,
  MenuCategoryFilters,
  MenuCategoryPayload,
  MenuItem,
  MenuItemFilters,
  MenuItemPayload,
} from "./types";

let mockCategories: MenuCategory[] = [...seedCategories];

let mockMenuItems: MenuItem[] = [...seedMenuItems];

// Modifiers skeleton — no raw material mapping this phase
let mockModifierGroups: import("./types").ModifierGroup[] = [
  {
    id: "mg_001",
    name: "Add-ons",
    selection_type: "multiple",
    min_selection: 0,
    max_selection: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mg_002",
    name: "Spice Level",
    selection_type: "single",
    min_selection: 0,
    max_selection: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
let mockModifiers: import("./types").Modifier[] = [
  { id: "mod_001", modifier_group_id: "mg_001", name: "Extra Cheese", price: 20, is_active: true },
  { id: "mod_002", modifier_group_id: "mg_001", name: "Extra Chicken", price: 40, is_active: true },
  { id: "mod_003", modifier_group_id: "mg_002", name: "Less Spicy", price: 0, is_active: true },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const MENU_STORAGE_KEY = "pixaMenu";

function saveMenu() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        MENU_STORAGE_KEY,
        JSON.stringify({
          version: MENU_SEED_VERSION,
          categories: mockCategories,
          items: mockMenuItems,
          modifierGroups: mockModifierGroups,
          modifiers: mockModifiers,
        }),
      );
    } catch {}
  }
}

function loadMenu(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(MENU_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Stale dev cache (pre-seed or older version) → reseed with the
        // current seed-data and persist, so code changes reach every tab.
        if ((parsed?.version ?? 1) !== MENU_SEED_VERSION) {
          mockCategories = [...seedCategories];
          mockMenuItems = [...seedMenuItems];
          saveMenu();
          return;
        }
        if (Array.isArray(parsed?.categories)) mockCategories = parsed.categories;
        if (Array.isArray(parsed?.items))
          // Backfill arrays for rows written before they were guaranteed.
          mockMenuItems = parsed.items.map((m: any) => ({ ...m, variants: m.variants ?? [] }));
        if (Array.isArray(parsed?.modifierGroups)) mockModifierGroups = parsed.modifierGroups;
        if (Array.isArray(parsed?.modifiers)) mockModifiers = parsed.modifiers;
      }
    } catch {}
  }
}

// Categories
export async function getMenuCategories(filters?: MenuCategoryFilters): Promise<MenuCategory[]> {
  await delay(300);
  loadMenu(); // localStorage is the shared source — reload so tabs/displays agree
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
  loadMenu();
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
    image_url: (payload as any).image_url,
    parent_id: (payload as any).parent_id,
    sort_order: payload.sort_order ?? mockCategories.length + 1,
    is_active: payload.is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockCategories.push(cat);
  saveMenu();
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
  saveMenu();
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
  saveMenu();
}

// Menu Items
export async function getMenuItems(filters?: MenuItemFilters): Promise<MenuItem[]> {
  await delay(400);
  loadMenu();
  let r = [...mockMenuItems].sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.slug.includes(q) ||
        (m.variants ?? []).some(
          (v) => v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q),
        ),
    );
  }
  if (filters?.category_id) r = r.filter((m) => m.category_id === filters.category_id);
  if (filters?.veg_type) r = r.filter((m) => m.veg_type === filters.veg_type);
  if (filters?.channel) r = r.filter((m) => m.available_channels.includes(filters.channel!));
  if (filters?.item_type) r = r.filter((m) => (m as any).item_type === filters.item_type);
  if (filters?.is_active !== undefined) r = r.filter((m) => m.is_active === filters.is_active);
  return r;
}
export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  await delay(300);
  loadMenu();
  return mockMenuItems.find((m) => m.id === id) ?? null;
}
export async function createMenuItem(payload: MenuItemPayload): Promise<MenuItem> {
  await delay(600);
  const productType =
    (payload as any).product_type ??
    (payload.variants && payload.variants.length > 1 ? "variant" : "simple");
  const itemType = (payload as any).item_type ?? "service";
  // images: accept image_urls or images array, max 6, urls must be valid
  const rawUrls: string[] =
    (payload as any).image_urls ??
    ((payload as any).images ? (payload as any).images.map((i: any) => i.url ?? i) : []);
  if (rawUrls.length > 6) throw new Error("Max 6 images");
  const images = rawUrls.map((url, idx) => ({ url, sort_order: idx }));
  const image_urls = rawUrls;
  const image_url = rawUrls[0];
  const variantsInput =
    payload.variants && payload.variants.length > 0
      ? payload.variants
      : [
          {
            name: "Regular",
            sku: "",
            selling_price: (payload as any).basePrice ?? 0,
            is_active: true,
          },
        ];
  if (variantsInput.length > 0) {
    const skus = variantsInput.map((v) => (v.sku ?? "").toLowerCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) throw new Error("Variant SKU duplicate");
    if (
      skus.some((s) =>
        mockMenuItems.flatMap((m) => m.variants).some((v) => v.sku.toLowerCase() === s),
      )
    )
      throw new Error("SKU already exists");
  }
  if (payload.hsn_code) {
    if (itemType === "service" && !/^[0-9]{6}$/.test(payload.hsn_code))
      throw new Error("Invalid SAC 6 digits for service (e.g., 996331, 999732)");
    if (itemType === "goods" && !/^[0-9]{4,8}$/.test(payload.hsn_code))
      throw new Error("Invalid HSN 4-8 digits for goods");
  }
  const now = new Date().toISOString();
  const slug = (payload as any).slug ?? slugify(payload.name);
  if (mockMenuItems.some((m) => m.slug === slug)) throw new Error("Slug already exists");
  const cat = mockCategories.find((c) => c.id === payload.category_id);
  const id = `mi_${Date.now().toString(36)}`;
  const variants = (productType === "simple" ? [variantsInput[0]] : variantsInput).map(
    (v: any, idx: number) => ({
      id: v.id ?? `mv_${Date.now().toString(36)}_${idx}`,
      menu_item_id: id,
      name: v.name ?? "Regular",
      sku: (v.sku ?? `${slug.toUpperCase()}-${String(idx + 1).padStart(3, "0")}`).toUpperCase(),
      barcode: v.barcode,
      qty: v.qty,
      unit: v.unit,
      selling_price: Number(v.selling_price ?? 0),
      compare_price: v.compare_price,
      recipe_id: v.recipe_id || undefined,
      is_active: v.is_active ?? true,
    }),
  );
  const item: MenuItem = {
    id,
    name: payload.name,
    slug,
    category_id: payload.category_id,
    category_name: cat?.name,
    description: (payload as any).description,
    image_url,
    images,
    image_urls,
    item_type: itemType,
    product_type: productType,
    veg_type: (payload as any).veg_type ?? "veg",
    spice_level: (payload as any).spice_level,
    prep_time_min: (payload as any).prep_time_min,
    allergens: (payload as any).allergens,
    taxable: (payload as any).taxable ?? false,
    tax_type: (payload as any).tax_type,
    tax_percent: (payload as any).tax_percent,
    hsn_code: (payload as any).hsn_code,
    available_channels: (payload as any).available_channels ?? ["dine_in", "pickup", "delivery"],
    nutrition: (payload as any).nutrition ?? undefined,
    variants,
    modifier_group_ids: (payload as any).modifier_group_ids ?? [],
    is_active: (payload as any).is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  mockMenuItems.push(item);
  saveMenu();
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
  // validate images if provided
  let image_patch: Partial<MenuItem> = {};
  if ((payload as any).image_urls !== undefined || (payload as any).images !== undefined) {
    const raw: string[] =
      (payload as any).image_urls ??
      ((payload as any).images ? (payload as any).images.map((i: any) => i.url ?? i) : []);
    if (raw.length > 6) throw new Error("Max 6 images");
    image_patch = {
      images: raw.map((url, idx) => ({ url, sort_order: idx })),
      image_urls: raw,
      image_url: raw[0],
    } as any;
  }
  if ((payload as any).hsn_code) {
    const it = (payload as any).item_type ?? (current as any).item_type ?? "service";
    if (it === "service" && !/^[0-9]{6}$/.test((payload as any).hsn_code))
      throw new Error("Invalid SAC 6 digits for service");
    if (it === "goods" && !/^[0-9]{4,8}$/.test((payload as any).hsn_code))
      throw new Error("Invalid HSN 4-8 digits for goods");
  }
  let variants = current.variants;
  if (payload.variants) {
    const pt = (payload as any).product_type ?? current.product_type;
    const input = pt === "simple" ? [payload.variants[0]] : payload.variants;
    variants = (input as any).map((v: any, vidx: number) => ({
      id: v.id ?? `mv_${Date.now().toString(36)}_${vidx}`,
      menu_item_id: id,
      name: v.name ?? "Regular",
      sku: (v.sku ?? `SKU-${vidx}`).toUpperCase(),
      barcode: v.barcode,
      qty: v.qty,
      unit: v.unit,
      selling_price: Number(v.selling_price ?? 0),
      compare_price: v.compare_price,
      recipe_id: v.recipe_id || undefined,
      is_active: v.is_active ?? true,
    }));
  }
  const updated: MenuItem = {
    ...current,
    ...payload,
    ...image_patch,
    slug: (payload as any).slug ?? current.slug,
    category_name: cat?.name ?? current.category_name,
    variants,
    modifier_group_ids:
      (payload as any).modifier_group_ids ?? (current as any).modifier_group_ids ?? [],
    updated_at: new Date().toISOString(),
  };
  mockMenuItems[idx] = updated;
  saveMenu();
  return { ...updated };
}

export async function getModifierGroups(): Promise<import("./types").ModifierGroup[]> {
  await delay(300);
  loadMenu();
  return [...mockModifierGroups];
}
export async function getModifierGroupById(
  id: string,
): Promise<import("./types").ModifierGroup | null> {
  await delay(200);
  loadMenu();
  return mockModifierGroups.find((g) => g.id === id) ?? null;
}
export async function getModifiers(groupId?: string): Promise<import("./types").Modifier[]> {
  await delay(300);
  loadMenu();
  let r = [...mockModifiers];
  if (groupId) r = r.filter((m) => m.modifier_group_id === groupId);
  return r.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function nextModifierSort(groupId: string): number {
  const orders = mockModifiers
    .filter((m) => m.modifier_group_id === groupId)
    .map((m) => m.sort_order ?? 0);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

export async function createModifierGroup(payload: {
  name: string;
  selection_type?: "single" | "multiple";
  min_selection?: number;
  max_selection?: number;
}): Promise<import("./types").ModifierGroup> {
  await delay(400);
  loadMenu();
  const name = payload.name.trim();
  if (name.length < 2) throw new Error("Group name must be at least 2 characters");
  if (mockModifierGroups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Add-on group already exists");
  }
  const min = Math.max(0, Math.floor(payload.min_selection ?? 0));
  const max = Math.max(
    1,
    Math.floor(payload.max_selection ?? (payload.selection_type === "single" ? 1 : 3)),
  );
  if (max < min) throw new Error("Max must be greater than or equal to min");
  const now = new Date().toISOString();
  const group = {
    id: `mg_${Date.now().toString(36)}`,
    name,
    selection_type: (max === 1 ? "single" : (payload.selection_type ?? "multiple")) as
      | "single"
      | "multiple",
    min_selection: min,
    max_selection: max,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  mockModifierGroups.push(group);
  saveMenu();
  return { ...group };
}

export async function updateModifierGroup(
  id: string,
  payload: Partial<
    Pick<
      import("./types").ModifierGroup,
      "name" | "selection_type" | "min_selection" | "max_selection" | "is_active"
    >
  >,
): Promise<import("./types").ModifierGroup> {
  await delay(400);
  loadMenu();
  const idx = mockModifierGroups.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error("Add-on group not found");
  const current = mockModifierGroups[idx];
  const min =
    payload.min_selection !== undefined
      ? Math.max(0, Math.floor(payload.min_selection))
      : current.min_selection;
  const max =
    payload.max_selection !== undefined
      ? Math.max(1, Math.floor(payload.max_selection))
      : current.max_selection;
  if (max < min) throw new Error("Max must be greater than or equal to min");
  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (name.length < 2) throw new Error("Group name must be at least 2 characters");
    if (
      mockModifierGroups.some((g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase())
    ) {
      throw new Error("Add-on group already exists");
    }
  }
  mockModifierGroups[idx] = {
    ...current,
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.selection_type !== undefined ? { selection_type: payload.selection_type } : {}),
    min_selection: min,
    max_selection: max,
    selection_type: max === 1 ? "single" : (payload.selection_type ?? current.selection_type),
    ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
    updated_at: new Date().toISOString(),
  };
  saveMenu();
  return { ...mockModifierGroups[idx] };
}

export async function deleteModifierGroup(id: string): Promise<void> {
  await delay(400);
  loadMenu();
  const idx = mockModifierGroups.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error("Add-on group not found");
  if (mockMenuItems.some((m) => ((m as any).modifier_group_ids ?? []).includes(id))) {
    throw new Error("Group is linked to menu items — unlink it first");
  }
  mockModifierGroups.splice(idx, 1);
  mockModifiers = mockModifiers.filter((m) => m.modifier_group_id !== id);
  saveMenu();
}

export async function createModifier(payload: {
  modifier_group_id: string;
  name: string;
  alias?: string;
  price?: number;
}): Promise<import("./types").Modifier> {
  await delay(400);
  loadMenu();
  const group = mockModifierGroups.find((g) => g.id === payload.modifier_group_id);
  if (!group) throw new Error("Add-on group not found");
  const name = payload.name.trim();
  if (name.length < 2) throw new Error("Add-on name must be at least 2 characters");
  const price = Number(payload.price ?? 0);
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be 0 or more");
  const now = new Date().toISOString();
  const mod = {
    id: `mod_${Date.now().toString(36)}`,
    modifier_group_id: group.id,
    name,
    alias: payload.alias?.trim() || undefined,
    price,
    sort_order: nextModifierSort(group.id),
    is_active: true,
  };
  mockModifiers.push(mod);
  saveMenu();
  return { ...mod };
}

export async function updateModifier(
  id: string,
  payload: Partial<Pick<import("./types").Modifier, "name" | "alias" | "price" | "is_active">>,
): Promise<import("./types").Modifier> {
  await delay(300);
  loadMenu();
  const idx = mockModifiers.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Add-on not found");
  if (payload.name !== undefined && payload.name.trim().length < 2) {
    throw new Error("Add-on name must be at least 2 characters");
  }
  if (
    payload.price !== undefined &&
    (!Number.isFinite(Number(payload.price)) || Number(payload.price) < 0)
  ) {
    throw new Error("Price must be 0 or more");
  }
  mockModifiers[idx] = {
    ...mockModifiers[idx],
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    alias:
      payload.alias !== undefined ? payload.alias.trim() || undefined : mockModifiers[idx].alias,
    ...(payload.price !== undefined ? { price: Number(payload.price) } : {}),
    ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
  };
  saveMenu();
  return { ...mockModifiers[idx] };
}

export async function deleteModifier(id: string): Promise<void> {
  await delay(300);
  loadMenu();
  const idx = mockModifiers.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Add-on not found");
  mockModifiers.splice(idx, 1);
  saveMenu();
}

export async function moveModifier(id: string, direction: -1 | 1): Promise<void> {
  await delay(200);
  loadMenu();
  const mod = mockModifiers.find((m) => m.id === id);
  if (!mod) throw new Error("Add-on not found");
  const siblings = mockModifiers
    .filter((m) => m.modifier_group_id === mod.modifier_group_id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const pos = siblings.findIndex((m) => m.id === id);
  const swapWith = siblings[pos + direction];
  if (!swapWith) return;
  const a = mockModifiers.find((m) => m.id === id)!;
  const b = mockModifiers.find((m) => m.id === swapWith.id)!;
  const tmp = a.sort_order ?? 0;
  a.sort_order = b.sort_order ?? 0;
  b.sort_order = tmp;
  saveMenu();
}
export async function deleteMenuItem(id: string): Promise<void> {
  await delay(400);
  const idx = mockMenuItems.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Menu item not found");
  mockMenuItems.splice(idx, 1);
  saveMenu();
}
