import * as z from "zod";

export const purchaseReturnItemSchema = z.object({
  material_id: z.string().min(1, "Material required"),
  qty_returned: z.number().min(1, "Return qty ≥1"),
  qty_original: z.number().min(1).optional(),
  unit_cost: z.number().min(0).optional(),
  tax_percent: z.number().min(0).max(28).optional(),
});

export const purchaseReturnSchema = z.object({
  purchase_id: z.string().min(1, "Original purchase required"),
  reason: z.enum(["damaged", "expired", "short_supply", "wrong_item", "quality", "other"]),
  items: z.array(purchaseReturnItemSchema).min(1, "Add at least one return item"),
  restock: z.boolean().optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
  bill_date: z.string().optional().or(z.literal("")),
});

export type PurchaseReturnValues = z.infer<typeof purchaseReturnSchema>;
