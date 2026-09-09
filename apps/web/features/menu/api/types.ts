export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  sort_order?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VegType = "veg" | "nonveg" | "egg";
export type TaxTypeMenu = "GST" | "VAT";
export type Channel = "dine_in" | "pickup" | "delivery" | "zomato" | "swiggy" | "ondc";

export type MenuItemVariant = {
  id: string;
  menu_item_id: string;
  name: string; // e.g., Small, Large, 250ml, 100gr — user creates different type of variants
  sku: string;
  barcode?: string;
  qty?: number; // e.g., 250
  unit?: string; // ml, gr, pcs etc.
  selling_price: number;
  compare_price?: number;
  recipe_id?: string; // link to Recipe for cost_per_serve
  cost_per_serve?: number;
  is_default?: boolean;
  is_active: boolean;
};

export type ProductType = "simple" | "variant";
export type ItemType = "goods" | "service"; // Zoho Goods|Service / Odoo Goods|Service/Combo; RistaPOS goods vs service (packing charge)
export type MenuItemImage = { url: string; sort_order: number };
export type MenuItem = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name?: string;
  description?: string;
  image_url?: string; // deprecated alias = images[0].url
  images?: MenuItemImage[]; // gallery max 6 (Zoho 15 but POS cap 6)
  image_urls?: string[]; // flat alias for form
  item_type: ItemType; // goods = Supply of Goods (HSN + 5%/18%), service = Supply of Service (SAC 9973/9997 + 5%)
  product_type: ProductType; // simple = no variants (Regular), variant = has variants (Petpooja/Zoho)
  veg_type: VegType;
  spice_level?: "mild" | "medium" | "spicy";
  prep_time_min?: number;
  allergens?: string[];
  taxable: boolean;
  tax_type?: TaxTypeMenu;
  tax_percent?: number;
  hsn_code?: string; // HSN for goods (4-8 digits) or SAC for service (6 digits 9973/9997)
  available_channels: Channel[]; // dine_in, pickup, delivery, zomato, swiggy, ondc
  variants: MenuItemVariant[];
  modifier_group_ids?: string[]; // skeleton, no raw material mapping this phase
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ModifierGroup = {
  id: string;
  name: string;
  selection_type: "single" | "multiple";
  min_selection: number;
  max_selection: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type Modifier = {
  id: string;
  modifier_group_id: string;
  name: string;
  price: number;
  is_active: boolean;
};

// Payloads
export type MenuCategoryPayload = Partial<
  Omit<MenuCategory, "id" | "created_at" | "updated_at" | "slug">
> &
  Pick<MenuCategory, "name">;
export type MenuItemPayload = Partial<
  Omit<MenuItem, "id" | "created_at" | "updated_at" | "slug" | "category_name" | "variants">
> &
  Pick<MenuItem, "name" | "category_id"> & {
    variants?: Partial<MenuItemVariant>[];
    product_type?: ProductType;
    item_type?: ItemType;
    images?: MenuItemImage[];
    image_urls?: string[];
  };

// Filters
export type MenuCategoryFilters = { search?: string; is_active?: boolean };
export type MenuItemFilters = {
  search?: string;
  category_id?: string;
  veg_type?: VegType;
  channel?: Channel;
  item_type?: ItemType;
  is_active?: boolean;
};
