import * as z from "zod";

export const purchaseItemSchema = z.object({
  material_id: z.string().min(1, "Material required"),
  qty: z.number().min(1, "Qty ≥1"),
  unit_cost: z.number().min(0, "Cost ≥0"),
  tax_percent: z.number().min(0).max(28).optional(),
});

export const purchaseSchema = z.object({
  supplier_id: z.string().min(1, "Supplier required"),
  po_id: z.string().optional().or(z.literal("")),
  items: z.array(purchaseItemSchema).min(1, "Add at least one material"),
  bill_date: z.string().min(1, "Bill date required"),
  due_date: z.string().optional().or(z.literal("")),
  paid_amount: z.number().min(0).optional(),
  payment_mode: z.enum(["cash", "upi", "bank", "credit"]).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type PurchaseValues = z.infer<typeof purchaseSchema>;
