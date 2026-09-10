import * as z from "zod";

export const rawMaterialSchema = z.object({
  name: z.string().min(2, "Name min 2 chars").max(50),
  sku: z
    .string()
    .min(2, "SKU min 2")
    .max(20)
    .regex(/^[A-Za-z0-9-_]+$/, "Alphanumeric -/_"),
  category: z.string().min(2, "Category required"),
  unit: z.enum(["kg", "g", "l", "ml", "pcs", "box"]),
  purchase_unit: z
    .enum(["kg", "g", "l", "ml", "pcs", "box"])
    .optional()
    .or(z.literal("")),
  purchase_to_base_rate: z
    .number()
    .min(0.0001, "Rate > 0")
    .max(1000000)
    .optional()
    .or(z.literal("")),
  stock_qty: z.number().min(0),
  low_stock_threshold: z.number().min(0),
  opening_stock: z.number().min(0).optional(),
  cost_price: z.number().min(0),
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
}).superRefine((v, ctx) => {
  if (v.purchase_unit && v.purchase_unit !== v.unit) {
    const rate = v.purchase_to_base_rate;
    if (typeof rate !== "number" || !(rate > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["purchase_to_base_rate"],
        message: "Rate > 0 required when purchase unit differs",
      });
    }
  }
});

export type RawMaterialValues = z.infer<typeof rawMaterialSchema>;
