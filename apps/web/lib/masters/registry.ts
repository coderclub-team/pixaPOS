import {
  menuCategories,
  menuItems,
  menuVariants,
  modifierGroups,
  modifiers,
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
};

export const MASTER_REGISTRY: Record<MasterType, RegistryEntry> = {
  categories: {
    table: menuCategories,
    permission: "org:menu:manage",
    columns: ["name", "slug", "parent_id", "sort_order", "is_active"],
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
      "hsn_code",
      "taxable",
      "tax_percent",
      "modifier_group_ids",
      "is_active",
    ],
  },
  variants: {
    table: menuVariants,
    permission: "org:menu:manage",
    columns: [
      "name",
      "menu_item_id",
      "sku",
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
  },
  modifiers: {
    table: modifiers,
    permission: "org:menu:manage",
    columns: ["name", "group_id", "price", "sort_order", "is_active"],
  },
  materials: {
    table: rawMaterials,
    permission: "org:inventory:manage",
    columns: ["name", "sku", "unit", "supplier_id", "tax_percent", "hsn_code", "is_active"],
  },
  recipes: {
    table: recipes,
    permission: "org:inventory:manage",
    columns: ["name", "yields", "menu_item_id", "is_active"],
  },
  suppliers: {
    table: suppliers,
    permission: "org:inventory:manage",
    columns: ["name", "phone", "gstin", "is_active"],
  },
};
