import * as z from "zod";

export const menuVariantSchema = z.object({
  name: z.string().min(1, "Variant name required"), // Small, Large, 250ml etc — user creates different type
  sku: z.string().min(2, "SKU required"),
  qty: z.number().min(0).optional(),
  unit: z.string().optional(), // ml, gr, pcs
  selling_price: z.number().min(0, "Price ≥0"),
  compare_price: z.number().min(0).optional(),
  recipe_id: z.string().optional().or(z.literal("")),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const menuItemSchema = z.object({
  name: z.string().min(2, "Name required").max(50),
  category_id: z.string().min(1, "Category required"),
  description: z.string().max(500).optional().or(z.literal("")),
  product_type: z.enum(["simple", "variant"]).optional(),
  item_type: z.enum(["goods", "service"]).optional(),
  image_urls: z.array(z.string().url()).max(6, "Max 6 images").optional(),
  veg_type: z.enum(["veg", "nonveg", "egg"]),
  spice_level: z.enum(["mild", "medium", "spicy"]).optional().or(z.literal("")),
  prep_time_min: z.number().min(0).optional(),
  taxable: z.boolean().optional(),
  tax_type: z.enum(["GST", "VAT"]).optional().or(z.literal("")),
  tax_percent: z.number().min(0).max(28).optional(),
  hsn_code: z.string().optional().or(z.literal("")),
  available_channels: z
    .array(z.enum(["dine_in", "pickup", "delivery", "zomato", "swiggy", "ondc"]))
    .optional(),
  is_active: z.boolean().optional(),
  variants: z
    .array(menuVariantSchema)
    .min(1, "Add at least one variant (Small/Large/250ml)")
    .max(8, "Max 8 variants"),
});
export type MenuItemValues = z.infer<typeof menuItemSchema>;
