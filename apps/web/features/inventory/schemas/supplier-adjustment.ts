import * as z from "zod";

export const supplierAdjustmentSchema = z.object({
  supplier_id: z.string().min(1, "Supplier required"),
  type: z.enum(["credit", "debit"]),
  category: z.enum([
    "rate_difference",
    "discount",
    "shortage",
    "freight",
    "tax_correction",
    "opening_balance",
    "other",
  ]),
  purchase_id: z.string().optional().or(z.literal("")),
  amount: z.number().min(0.01, "Amount > 0"),
  bill_date: z.string().min(1, "Date required"),
  reference: z.string().max(30).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type SupplierAdjustmentValues = z.infer<typeof supplierAdjustmentSchema>;
