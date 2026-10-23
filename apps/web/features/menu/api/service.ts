/**
 * Menu domain service — server-backed (Postgres via /api/masters).
 *
 * Every function keeps its historical signature so dashboard, terminal and
 * KDS callers are unchanged. Reads hit the server (outlet-filtered when an
 * outlet_id is passed — closed by default, enforced server-side via the
 * outlet_* mapping tables). There is no localStorage mirror: the catalog is
 * identical in every tab, outlet and device.
 */
import type {
  MenuCategory,
  MenuCategoryFilters,
  MenuCategoryPayload,
  MenuItem,
  MenuItemFilters,
  MenuItemPayload,
} from "./types";
import type { ModifierGroup, Modifier } from "./types";

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/* ---------------- row mappers (server camelCase -> client snake_case) ---------------- */

function toClientCategory(r: Record<string, any>): MenuCategory {
  return {
    id: String(r.id),
    name: r.name as string,
    slug: (r.slug as string) ?? "",
    description: (r.description as string | null) ?? undefined,
    image_url: (r.imageUrl as string | null) ?? undefined,
    parent_id: (r.parentId as string | null) ?? undefined,
    sort_order: (r.sortOrder as number | null) ?? 0,
    is_active: (r.isActive as boolean | undefined) ?? true,
    created_at: String(r.createdAt ?? new Date().toISOString()),
    updated_at: String(r.updatedAt ?? new Date().toISOString()),
  };
}

function toClientVariant(r: Record<string, any>): MenuItem["variants"][number] {
  return {
    id: String(r.id),
    menu_item_id: String(r.menuItemId ?? ""),
    name: r.name as string,
    sku: (r.sku as string | null) ?? "",
    barcode: (r.barcode as string | null) ?? undefined,
    qty: r.qty == null ? undefined : Number(r.qty),
    unit: (r.unit as string | null) ?? undefined,
    selling_price: Number(r.sellingPrice ?? 0),
    compare_price: r.comparePrice == null ? undefined : Number(r.comparePrice),
    recipe_id: (r.recipeId as string | null) ?? undefined,
    is_default: (r.isDefault as boolean | undefined) ?? undefined,
    is_active: (r.isActive as boolean | undefined) ?? true,
  };
}

function toClientItem(r: Record<string, any>): MenuItem {
  const images: { url: string; sort_order: number }[] = Array.isArray(r.images) ? r.images : [];
  const variantsRaw: Record<string, any>[] = Array.isArray(r.variants) ? r.variants : [];
  return {
    id: String(r.id),
    name: r.name as string,
    slug: (r.slug as string | null) ?? "",
    barcode: (r.barcode as string | null) ?? undefined,
    category_id: String(r.categoryId ?? ""),
    category_name: (r.category_name as string | null) ?? undefined,
    description: (r.description as string | null) ?? undefined,
    image_url: images[0]?.url,
    images,
    image_urls: images.map((i) => i.url),
    item_type: ((r.itemType as string) ?? "service") as MenuItem["item_type"],
    product_type: ((r.productType as string) ?? "service") as MenuItem["product_type"],
    veg_type: ((r.vegType as string) ?? "veg") as MenuItem["veg_type"],
    spice_level: (r.spiceLevel as MenuItem["spice_level"]) ?? undefined,
    prep_time_min: (r.prepTimeMin as number | null) ?? undefined,
    allergens: Array.isArray(r.allergens) ? r.allergens : undefined,
    taxable: (r.taxable as boolean | undefined) ?? false,
    tax_type: (r.taxType as MenuItem["tax_type"]) ?? undefined,
    tax_percent: (r.taxPercent as number | null) ?? undefined,
    hsn_code: (r.hsnCode as string | null) ?? undefined,
    available_channels: (Array.isArray(r.availableChannels) && r.availableChannels.length > 0
      ? r.availableChannels
      : [
          "dine_in",
          "pickup",
          "delivery",
          "zomato",
          "swiggy",
          "ondc",
        ]) as MenuItem["available_channels"],
    nutrition: (r.nutrition as MenuItem["nutrition"]) ?? undefined,
    pairs_well_with: Array.isArray(r.pairsWellWith) ? r.pairsWellWith : undefined,
    is_bestseller: (r.isBestseller as boolean | undefined) ?? undefined,
    variants: variantsRaw.map(toClientVariant),
    modifier_group_ids: Array.isArray(r.modifierGroupIds) ? r.modifierGroupIds : [],
    is_active: (r.isActive as boolean | undefined) ?? true,
    created_at: String(r.createdAt ?? new Date().toISOString()),
    updated_at: String(r.updatedAt ?? new Date().toISOString()),
  };
}

function toClientGroup(r: Record<string, any>): ModifierGroup {
  return {
    id: String(r.id),
    name: r.name as string,
    selection_type: (r.selectionType as "single" | "multiple" | undefined) ?? "multiple",
    min_selection: Number(r.minSelection ?? 0),
    max_selection: Number(r.maxSelection ?? 3),
    is_active: (r.isActive as boolean | undefined) ?? true,
    created_at: String(r.createdAt ?? new Date().toISOString()),
    updated_at: String(r.updatedAt ?? new Date().toISOString()),
  };
}

function toClientModifier(r: Record<string, any>): Modifier {
  return {
    id: String(r.id),
    modifier_group_id: String(r.groupId ?? ""),
    name: r.name as string,
    alias: (r.alias as string | null) ?? undefined,
    price: Number(r.price ?? 0),
    sort_order: (r.sortOrder as number | null) ?? undefined,
    is_active: (r.isActive as boolean | undefined) ?? true,
  };
}

/* ---------------- categories ---------------- */

export async function getMenuCategories(filters?: MenuCategoryFilters): Promise<MenuCategory[]> {
  const q = new URLSearchParams();
  if (filters?.outlet_id) q.set("outlet_id", filters.outlet_id);
  const qs = q.toString();
  const { rows } = await api<{ rows: Record<string, any>[] }>(
    `/api/masters/categories${qs ? `?${qs}` : ""}`,
  );
  let r = (rows ?? [])
    .map(toClientCategory)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    r = r.filter((c) => c.name.toLowerCase().includes(s) || c.slug.includes(s));
  }
  if (filters?.is_active !== undefined) r = r.filter((c) => c.is_active === filters.is_active);
  return r;
}

export async function getMenuCategoryById(id: string): Promise<MenuCategory | null> {
  try {
    const { row } = await api<{ row: Record<string, any> | null }>(
      `/api/masters/categories/${encodeURIComponent(id)}`,
    );
    return row ? toClientCategory(row) : null;
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) return null;
    throw e;
  }
}

export async function createMenuCategory(
  payload: MenuCategoryPayload,
  opts?: { outletId?: string },
): Promise<MenuCategory> {
  const existing = await getMenuCategories();
  if (existing.some((c) => c.name.toLowerCase() === payload.name.trim().toLowerCase()))
    throw new Error("Category already exists");
  const body: Record<string, unknown> = {
    name: payload.name.trim(),
    slug: (payload as any).slug ?? slugify(payload.name),
    description: (payload as any).description ?? undefined,
    image_url: (payload as any).image_url ?? undefined,
    parent_id: (payload as any).parent_id || undefined,
    sort_order: payload.sort_order ?? existing.length + 1,
    is_active: payload.is_active ?? true,
  };
  if (opts?.outletId) body.outlet_ids = [opts.outletId];
  const created = await api<{ id: string }>("/api/masters/categories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const row = await getMenuCategoryById(created.id);
  if (!row) throw new Error("Category created but could not be reloaded");
  return row;
}

export async function updateMenuCategory(
  id: string,
  payload: MenuCategoryPayload,
): Promise<MenuCategory> {
  const body: Record<string, unknown> = {
    name: payload.name.trim(),
    slug: (payload as any).slug,
    description: (payload as any).description,
    image_url: (payload as any).image_url,
    parent_id: (payload as any).parent_id,
    sort_order: payload.sort_order,
    is_active: payload.is_active,
  };
  await api(`/api/masters/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const row = await getMenuCategoryById(id);
  if (!row) throw new Error("Category not found");
  return row;
}

export async function deleteMenuCategory(id: string): Promise<void> {
  const items = await getMenuItems();
  if (items.some((m) => m.category_id === id)) throw new Error("Category in use by menu items");
  const cats = await getMenuCategories();
  if (cats.some((c) => c.parent_id === id)) throw new Error("Category has sub-categories");
  await api(`/api/masters/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ---------------- items ---------------- */

function withItemClientFilters(list: MenuItem[], filters?: MenuItemFilters): MenuItem[] {
  let r = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    r = r.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.slug.includes(q) ||
        (m.barcode ?? "").toLowerCase().includes(q) ||
        m.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(q) ||
            v.name.toLowerCase().includes(q) ||
            (v.barcode ?? "").toLowerCase().includes(q),
        ),
    );
  }
  if (filters?.category_id) r = r.filter((m) => m.category_id === filters.category_id);
  if (filters?.veg_type) r = r.filter((m) => m.veg_type === filters.veg_type);
  if (filters?.channel) r = r.filter((m) => m.available_channels.includes(filters.channel!));
  if (filters?.item_type) r = r.filter((m) => m.item_type === filters.item_type);
  if (filters?.is_active !== undefined) r = r.filter((m) => m.is_active === filters.is_active);
  return r;
}

export async function getMenuItems(filters?: MenuItemFilters): Promise<MenuItem[]> {
  const q = new URLSearchParams();
  if (filters?.outlet_id) q.set("outlet_id", filters.outlet_id);
  const qs = q.toString();
  const { rows } = await api<{ rows: Record<string, any>[] }>(
    `/api/masters/items${qs ? `?${qs}` : ""}`,
  );
  let list = (rows ?? []).map(toClientItem);
  // Apply local price overrides on top of server availability.
  if (filters?.outlet_id) {
    try {
      const { getPriceOverride } = await import("@/features/outlet/api/availability");
      const outletId = filters.outlet_id;
      list = list.map((m) => {
        const override = getPriceOverride(outletId, "menu_item", m.id);
        if (override === undefined) return m;
        return { ...m, variants: m.variants.map((v) => ({ ...v, selling_price: override })) };
      });
    } catch {
      /* ignore — no local overrides */
    }
  }
  return withItemClientFilters(list, filters);
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  try {
    const { row } = await api<{ row: Record<string, any> | null }>(
      `/api/masters/items/${encodeURIComponent(id)}`,
    );
    return row ? toClientItem(row) : null;
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) return null;
    throw e;
  }
}

type VariantInput = Partial<
  Pick<
    MenuItem["variants"][number],
    | "name"
    | "sku"
    | "barcode"
    | "qty"
    | "unit"
    | "selling_price"
    | "compare_price"
    | "recipe_id"
    | "is_default"
    | "is_active"
  >
> & { id?: string };

async function postVariant(itemId: string, v: VariantInput): Promise<void> {
  await api("/api/masters/variants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      menu_item_id: itemId,
      name: v.name ?? "Regular",
      sku: (v.sku ?? "").toUpperCase(),
      barcode: v.barcode ?? undefined,
      qty: v.qty ?? undefined,
      unit: v.unit ?? undefined,
      selling_price: Number(v.selling_price ?? 0),
      compare_price: v.compare_price ?? undefined,
      recipe_id: v.recipe_id || undefined,
      is_default: v.is_default ?? false,
      is_active: v.is_active ?? true,
    }),
  });
}

export async function createMenuItem(
  payload: MenuItemPayload,
  opts?: { outletId?: string },
): Promise<MenuItem> {
  const productType =
    (payload as any).product_type ??
    (payload.variants && payload.variants.length > 1 ? "variant" : "simple");
  const itemType = (payload as any).item_type ?? "service";
  const rawUrls: string[] =
    (payload as any).image_urls ??
    ((payload as any).images ? (payload as any).images.map((i: any) => i.url ?? i) : []);
  if (rawUrls.length > 6) throw new Error("Max 6 images");
  if ((payload as any).hsn_code) {
    if (itemType === "service" && !/^[0-9]{6}$/.test((payload as any).hsn_code))
      throw new Error("Invalid SAC 6 digits for service (e.g., 996331, 999732)");
    if (itemType === "goods" && !/^[0-9]{4,8}$/.test((payload as any).hsn_code))
      throw new Error("Invalid HSN 4-8 digits for goods");
  }
  // SKU uniqueness (org-wide).
  const variantsInput: VariantInput[] =
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
  const skus = variantsInput.map((v) => (v.sku ?? "").toLowerCase()).filter(Boolean);
  if (new Set(skus).size !== skus.length) throw new Error("Variant SKU duplicate");
  if (skus.length > 0) {
    const { rows } = await api<{ rows: Record<string, any>[] }>("/api/masters/variants");
    const taken = new Set(
      (rows ?? []).flatMap((r) => {
        const s = String((r as any).sku ?? "").toLowerCase();
        return s ? [s] : [];
      }),
    );
    const clash = skus.find((s) => taken.has(s));
    if (clash) throw new Error("SKU already exists");
  }
  const slug = (payload as any).slug ?? slugify(payload.name);
  const items = await getMenuItems();
  if (items.some((m) => m.slug === slug)) throw new Error("Slug already exists");
  const body: Record<string, unknown> = {
    name: payload.name.trim(),
    slug,
    category_id: payload.category_id,
    product_type: productType,
    item_type: itemType,
    veg_type: (payload as any).veg_type ?? "veg",
    spice_level: (payload as any).spice_level ?? undefined,
    prep_time_min: (payload as any).prep_time_min ?? undefined,
    allergens: (payload as any).allergens ?? undefined,
    description: (payload as any).description ?? undefined,
    images: rawUrls.map((url, idx) => ({ url, sort_order: idx })),
    available_channels: (payload as any).available_channels ?? ["dine_in", "pickup", "delivery"],
    nutrition: (payload as any).nutrition ?? undefined,
    pairs_well_with: (payload as any).pairs_well_with ?? [],
    is_bestseller: (payload as any).is_bestseller ?? false,
    taxable: (payload as any).taxable ?? false,
    tax_type: (payload as any).tax_type ?? undefined,
    tax_percent: (payload as any).tax_percent ?? undefined,
    hsn_code: (payload as any).hsn_code ?? undefined,
    modifier_group_ids: (payload as any).modifier_group_ids ?? [],
    is_active: (payload as any).is_active ?? true,
  };
  if (opts?.outletId) body.outlet_ids = [opts.outletId];
  const created = await api<{ id: string }>("/api/masters/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const variants = productType === "simple" ? [variantsInput[0]] : variantsInput;
  for (const v of variants) {
    await postVariant(created.id, v);
  }
  const row = await getMenuItemById(created.id);
  if (!row) throw new Error("Menu item created but could not be reloaded");
  return row;
}

export async function updateMenuItem(id: string, payload: MenuItemPayload): Promise<MenuItem> {
  const current = await getMenuItemById(id);
  if (!current) throw new Error("Menu item not found");
  // validate images if provided
  const imagePatch: Record<string, unknown> = {};
  if ((payload as any).image_urls !== undefined || (payload as any).images !== undefined) {
    const raw: string[] =
      (payload as any).image_urls ??
      ((payload as any).images ? (payload as any).images.map((i: any) => i.url ?? i) : []);
    if (raw.length > 6) throw new Error("Max 6 images");
    imagePatch.images = raw.map((url, idx) => ({ url, sort_order: idx }));
  }
  if ((payload as any).hsn_code) {
    const it = (payload as any).item_type ?? current.item_type ?? "service";
    if (it === "service" && !/^[0-9]{6}$/.test((payload as any).hsn_code))
      throw new Error("Invalid SAC 6 digits for service");
    if (it === "goods" && !/^[0-9]{4,8}$/.test((payload as any).hsn_code))
      throw new Error("Invalid HSN 4-8 digits for goods");
  }
  const body: Record<string, unknown> = {
    name: payload.name !== undefined ? String(payload.name).trim() : undefined,
    slug: (payload as any).slug,
    category_id: payload.category_id,
    description: (payload as any).description,
    item_type: (payload as any).item_type,
    product_type: (payload as any).product_type,
    veg_type: (payload as any).veg_type,
    spice_level: (payload as any).spice_level,
    prep_time_min: (payload as any).prep_time_min,
    allergens: (payload as any).allergens,
    taxable: (payload as any).taxable,
    tax_type: (payload as any).tax_type,
    tax_percent: (payload as any).tax_percent,
    hsn_code: (payload as any).hsn_code,
    available_channels: (payload as any).available_channels,
    nutrition: (payload as any).nutrition,
    pairs_well_with: (payload as any).pairs_well_with,
    is_bestseller: (payload as any).is_bestseller,
    modifier_group_ids: (payload as any).modifier_group_ids,
    is_active: (payload as any).is_active,
    ...imagePatch,
  };
  await api(`/api/masters/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Sync variants: update by id, create new ones, delete removed ones.
  if (payload.variants) {
    const pt = (payload as any).product_type ?? current.product_type;
    const input = (pt === "simple" ? [payload.variants[0]] : payload.variants) as (VariantInput & {
      id?: string;
    })[];
    const currentIds = new Set(current.variants.map((v) => v.id));
    const incomingIds = new Set(input.map((v) => v.id).filter(Boolean) as string[]);
    for (const v of input) {
      if (v.id && currentIds.has(v.id)) {
        await api(`/api/masters/variants/${encodeURIComponent(v.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: v.name,
            sku: v.sku ? String(v.sku).toUpperCase() : undefined,
            barcode: v.barcode ?? undefined,
            qty: v.qty ?? undefined,
            unit: v.unit ?? undefined,
            selling_price: v.selling_price !== undefined ? Number(v.selling_price) : undefined,
            compare_price: v.compare_price,
            recipe_id: v.recipe_id || undefined,
            is_default: v.is_default,
            is_active: v.is_active,
          }),
        });
      } else {
        await postVariant(id, v);
      }
    }
    for (const oldId of currentIds) {
      if (!incomingIds.has(oldId) && current.variants.length > [...incomingIds].length) {
        await api(`/api/masters/variants/${encodeURIComponent(oldId)}`, { method: "DELETE" });
      }
    }
  }
  const row = await getMenuItemById(id);
  if (!row) throw new Error("Menu item not found");
  return row;
}

export async function deleteMenuItem(id: string): Promise<void> {
  await api(`/api/masters/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ---------------- modifier groups ---------------- */

export async function getModifierGroups(filters?: {
  outlet_id?: string;
}): Promise<import("./types").ModifierGroup[]> {
  const q = new URLSearchParams();
  if (filters?.outlet_id) q.set("outlet_id", filters.outlet_id);
  const qs = q.toString();
  const { rows } = await api<{ rows: Record<string, any>[] }>(
    `/api/masters/modifier-groups${qs ? `?${qs}` : ""}`,
  );
  return (rows ?? []).map(toClientGroup);
}

export async function getModifierGroupById(
  id: string,
): Promise<import("./types").ModifierGroup | null> {
  try {
    const { row } = await api<{ row: Record<string, any> | null }>(
      `/api/masters/modifier-groups/${encodeURIComponent(id)}`,
    );
    return row ? toClientGroup(row) : null;
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) return null;
    throw e;
  }
}

export async function getModifiers(groupId?: string): Promise<import("./types").Modifier[]> {
  const { rows } = await api<{ rows: Record<string, any>[] }>("/api/masters/modifiers");
  let r = (rows ?? []).map(toClientModifier);
  if (groupId) r = r.filter((m) => m.modifier_group_id === groupId);
  return r.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export async function createModifierGroup(
  payload: {
    name: string;
    selection_type?: "single" | "multiple";
    min_selection?: number;
    max_selection?: number;
  },
  opts?: { outletId?: string },
): Promise<import("./types").ModifierGroup> {
  const name = payload.name.trim();
  if (name.length < 2) throw new Error("Group name must be at least 2 characters");
  const min = Math.max(0, Math.floor(payload.min_selection ?? 0));
  const max = Math.max(
    1,
    Math.floor(payload.max_selection ?? (payload.selection_type === "single" ? 1 : 3)),
  );
  if (max < min) throw new Error("Max must be greater than or equal to min");
  const existing = await getModifierGroups();
  if (existing.some((g) => g.name.toLowerCase() === name.toLowerCase()))
    throw new Error("Add-on group already exists");
  const body: Record<string, unknown> = {
    name,
    selection_type: max === 1 ? "single" : (payload.selection_type ?? "multiple"),
    min_selection: min,
    max_selection: max,
    is_active: true,
  };
  if (opts?.outletId) body.outlet_ids = [opts.outletId];
  const created = await api<{ id: string }>("/api/masters/modifier-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const row = await getModifierGroupById(created.id);
  if (!row) throw new Error("Add-on group created but could not be reloaded");
  return row;
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
  const current = await getModifierGroupById(id);
  if (!current) throw new Error("Add-on group not found");
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
    const existing = await getModifierGroups();
    if (existing.some((g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase()))
      throw new Error("Add-on group already exists");
  }
  const body: Record<string, unknown> = {
    name: payload.name !== undefined ? payload.name.trim() : undefined,
    selection_type: max === 1 ? "single" : (payload.selection_type ?? current.selection_type),
    min_selection: min,
    max_selection: max,
    is_active: payload.is_active,
  };
  await api(`/api/masters/modifier-groups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const row = await getModifierGroupById(id);
  if (!row) throw new Error("Add-on group not found");
  return row;
}

export async function deleteModifierGroup(id: string): Promise<void> {
  const items = await getMenuItems();
  if (items.some((m) => (m.modifier_group_ids ?? []).includes(id)))
    throw new Error("Group is linked to menu items — unlink it first");
  await api(`/api/masters/modifier-groups/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function createModifier(payload: {
  modifier_group_id: string;
  name: string;
  alias?: string;
  price?: number;
}): Promise<import("./types").Modifier> {
  const group = await getModifierGroupById(payload.modifier_group_id);
  if (!group) throw new Error("Add-on group not found");
  const name = payload.name.trim();
  if (name.length < 2) throw new Error("Add-on name must be at least 2 characters");
  const price = Number(payload.price ?? 0);
  if (!Number.isFinite(price) || price < 0) throw new Error("Price must be 0 or more");
  const siblings = await getModifiers(group.id);
  const created = await api<{ id: string }>(`/api/masters/modifiers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      group_id: group.id,
      name,
      alias: payload.alias?.trim() || undefined,
      price,
      sort_order: siblings.length ? Math.max(...siblings.map((m) => m.sort_order ?? 0)) + 1 : 0,
      is_active: true,
    }),
  });
  const { row } = await api<{ row: Record<string, any> }>(
    `/api/masters/modifiers/${encodeURIComponent(created.id)}`,
  );
  return toClientModifier(row);
}

export async function updateModifier(
  id: string,
  payload: Partial<Pick<import("./types").Modifier, "name" | "alias" | "price" | "is_active">>,
): Promise<import("./types").Modifier> {
  if (payload.name !== undefined && payload.name.trim().length < 2) {
    throw new Error("Add-on name must be at least 2 characters");
  }
  if (
    payload.price !== undefined &&
    (!Number.isFinite(Number(payload.price)) || Number(payload.price) < 0)
  ) {
    throw new Error("Price must be 0 or more");
  }
  const body: Record<string, unknown> = {
    name: payload.name !== undefined ? payload.name.trim() : undefined,
    alias: payload.alias !== undefined ? payload.alias.trim() || undefined : undefined,
    price: payload.price !== undefined ? Number(payload.price) : undefined,
    is_active: payload.is_active,
  };
  await api(`/api/masters/modifiers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const { row } = await api<{ row: Record<string, any> }>(
    `/api/masters/modifiers/${encodeURIComponent(id)}`,
  );
  return toClientModifier(row);
}

export async function deleteModifier(id: string): Promise<void> {
  await api(`/api/masters/modifiers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function moveModifier(id: string, direction: -1 | 1): Promise<void> {
  const { row } = await api<{ row: Record<string, any> }>(
    `/api/masters/modifiers/${encodeURIComponent(id)}`,
  );
  if (!row) throw new Error("Add-on not found");
  const groupId = String((row as Record<string, any>).groupId);
  const all = await getModifiers(groupId);
  const pos = all.findIndex((m) => m.id === id);
  const swapWith = all[pos + direction];
  if (!swapWith) return;
  const aOrder = all[pos].sort_order ?? 0;
  const bOrder = swapWith.sort_order ?? 0;
  await api(`/api/masters/modifiers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sort_order: bOrder }),
  });
  await api(`/api/masters/modifiers/${encodeURIComponent(swapWith.id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sort_order: aOrder }),
  });
}
