import {
  menuCategories,
  menuItems,
  menuVariants,
  modifierGroups,
  modifiers,
  outletMenuCategories,
  outletMenuItems,
  outletModifierGroups,
  outletRawMaterials,
  outletRecipes,
  outletSuppliers,
  rawMaterials,
  recipes,
  suppliers,
} from "@pixa/db";

/**
 * Master-data type registry. Each entry declares its table, the permission
 * needed to write it, and which JSON body fields map to columns. Adding a
 * new master type = one entry here (plus its mapper in M1). No per-type
 * route files.
 */
export type MasterType =
  | "categories"
  | "items"
  | "variants"
  | "modifier-groups"
  | "modifiers"
  | "materials"
  | "recipes"
  | "suppliers";

export const MASTER_TYPES: MasterType[] = [
  "categories",
  "items",
  "variants",
  "modifier-groups",
  "modifiers",
  "materials",
  "recipes",
  "suppliers",
];

type RegistryEntry = {
  // Heterogeneous drizzle tables; call sites cast narrowly per operation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  permission: string;
  columns: string[];
  /**
   * Outlet-availability mapping for shareable masters. When present and the
   * request carries `outlet_id`, only mapped rows are returned/kept.
   * Modifiers follow their group, variants their item, ingredients their
   * recipe — no mapping rows needed for those types.
   */
  outletMap?: { table: any; entityColumn: string };
};

export const MASTER_REGISTRY: Record<MasterType, RegistryEntry> = {
  categories: {
    table: menuCategories,
    permission: "org:menu:manage",
    columns: ["name", "slug", "description", "image_url", "parent_id", "sort_order", "is_active"],
    outletMap: { table: outletMenuCategories, entityColumn: "category_id" },
  },
  items: {
    table: menuItems,
    permission: "org:menu:manage",
    columns: [
      "name",
      "category_id",
      "product_type",
      "item_type",
      "veg_type",
      "description",
      "barcode",
      "spice_level",
      "prep_time_min",
      "allergens",
      "hsn_code",
      "taxable",
      "tax_type",
      "tax_percent",
      "nutrition",
      "pairs_well_with",
      "is_bestseller",
      "images",
      "available_channels",
      "modifier_group_ids",
      "is_active",
    ],
    outletMap: { table: outletMenuItems, entityColumn: "item_id" },
  },
  variants: {
    table: menuVariants,
    permission: "org:menu:manage",
    columns: [
      "name",
      "menu_item_id",
      "sku",
      "barcode",
      "qty",
      "unit",
      "selling_price",
      "compare_price",
      "recipe_id",
      "is_default",
      "is_active",
    ],
  },
  "modifier-groups": {
    table: modifierGroups,
    permission: "org:menu:manage",
    columns: ["name", "selection_type", "min_selection", "max_selection", "is_active"],
    outletMap: { table: outletModifierGroups, entityColumn: "group_id" },
  },
  modifiers: {
    table: modifiers,
    permission: "org:menu:manage",
    columns: ["name", "group_id", "alias", "price", "sort_order", "is_active"],
  },
  materials: {
    table: rawMaterials,
    permission: "org:inventory:manage",
    columns: ["name", "sku", "unit", "supplier_id", "tax_percent", "hsn_code", "is_active"],
    outletMap: { table: outletRawMaterials, entityColumn: "material_id" },
  },
  recipes: {
    table: recipes,
    permission: "org:inventory:manage",
    columns: ["name", "yields", "menu_item_id", "is_active"],
    outletMap: { table: outletRecipes, entityColumn: "recipe_id" },
  },
  suppliers: {
    table: suppliers,
    permission: "org:inventory:manage",
    columns: ["name", "phone", "gstin", "is_active"],
    outletMap: { table: outletSuppliers, entityColumn: "supplier_id" },
  },
};
