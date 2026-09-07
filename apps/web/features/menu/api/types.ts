export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
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
  label?: string; // display like 250ml if name is Small — optional extra
  qty?: number; // e.g., 250
  unit?: string; // ml, gr, pcs etc.
  selling_price: number;
  compare_price?: number;
  recipe_id?: string; // link to Recipe for cost_per_serve
  cost_per_serve?: number;
  is_default?: boolean;
  is_active: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name?: string;
  description?: string;
  image_url?: string; // placeholder not used this phase
  veg_type: VegType;
  spice_level?: "mild" | "medium" | "spicy";
  prep_time_min?: number;
  allergens?: string[];
  taxable: boolean;
  tax_type?: TaxTypeMenu;
  tax_percent?: number;
  hsn_code?: string;
  available_channels: Channel[]; // dine_in, pickup, delivery, zomato, swiggy, ondc
  variants: MenuItemVariant[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  };

// Filters
export type MenuCategoryFilters = { search?: string; is_active?: boolean };
export type MenuItemFilters = {
  search?: string;
  category_id?: string;
  veg_type?: VegType;
  channel?: Channel;
  is_active?: boolean;
};
