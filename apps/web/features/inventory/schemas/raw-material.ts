import * as z from "zod";

export const rawMaterialSchema = z
  .object({
    name: z.string().min(2, "Name min 2 chars").max(50),
    sku: z
      .string()
      .min(2, "SKU min 2")
      .max(20)
      .regex(/^[A-Za-z0-9-_]+$/, "Alphanumeric -/_"),
    category: z.string().min(2, "Category required"),
    unit: z.enum(["kg", "g", "l", "ml", "pcs", "box"]),
    // Petpooja units
    base_unit: z.enum(["kg", "g", "l", "ml", "pcs"]).optional(),
    purchase_unit: z.enum(["kg", "g", "l", "ml", "pcs", "box", "tin", "sack"]).optional(),
    conversion_factor: z.number().min(0.0001).optional(),
    stock_qty: z.number().min(0),
    low_stock_threshold: z.number().min(0),
    // Extended stock levels
    minimum_stock_level: z.number().min(0).optional(),
    at_par_stock_level: z.number().min(0).optional(),
    maximum_stock_level: z.number().min(0).optional(),
    opening_stock: z.number().min(0).optional(),
    cost_price: z.number().min(0),
    reconciliation_price: z.number().min(0).optional(),
    transfer_price: z.number().min(0).optional(),
    tax_type: z.enum(["GST", "VAT"]).optional(),
    tax_percent: z.number().min(0).max(100).optional(),
    hsn_code: z
      .string()
      .regex(/^[0-9]{4,8}$/, "HSN 4-8 digits")
      .optional()
      .or(z.literal("")),
    barcode: z
      .string()
      .regex(/^[0-9]{8,14}$/, "Barcode 8-14 digits")
      .optional()
      .or(z.literal("")),
    supplier_id: z.string().optional().or(z.literal("")),
    suppliers: z
      .array(
        z.object({
          supplier_id: z.string().min(1),
          last_rate: z.number().min(0),
          is_preferred: z.boolean().optional(),
        }),
      )
      .optional(),
    is_active: z.boolean(),
    is_expiry: z.boolean().optional(),
    allow_decimal: z.boolean().optional(),
    exclusive: z.boolean().optional(),
    normal_loss_percent: z.number().min(0).max(100).optional(),
    description: z.string().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (
      data.base_unit &&
      data.purchase_unit &&
      data.base_unit !== data.purchase_unit &&
      !data.conversion_factor
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Conversion factor required when base and purchase units differ",
        path: ["conversion_factor"],
      });
    }
    if (data.hsn_code && data.hsn_code !== "" && !data.tax_percent && data.tax_percent !== 0) {
      // HSN without tax percent is allowed but warn - no issue
    }
  });

export type RawMaterialValues = z.infer<typeof rawMaterialSchema>;
