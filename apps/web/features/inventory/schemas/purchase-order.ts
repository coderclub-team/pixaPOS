import * as z from "zod";

export const poItemSchema = z.object({
  material_id: z.string().min(1, "Material required"),
  qty: z.number().min(1, "Qty ≥1"),
  unit_cost: z.number().min(0, "Cost ≥0"),
  tax_percent: z.number().min(0).max(28).optional(),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, "Supplier required"),
  po_date: z.string().min(1, "PO Date required"),
  reference: z.string().max(20).optional().or(z.literal("")),
  expected_at: z.string().optional().or(z.literal("")),
  payment_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  items: z.array(poItemSchema).min(1, "Add at least one material"),
});

export type PurchaseOrderValues = z.infer<typeof purchaseOrderSchema>;
