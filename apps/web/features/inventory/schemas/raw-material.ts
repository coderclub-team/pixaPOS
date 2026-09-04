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
  stock_qty: z.number().min(0),
  low_stock_threshold: z.number().min(0),
  cost_price: z.number().min(0),
  supplier_id: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type RawMaterialValues = z.infer<typeof rawMaterialSchema>;
