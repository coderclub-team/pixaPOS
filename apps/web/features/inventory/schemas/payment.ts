import * as z from "zod";

export const paymentSchema = z.object({
  supplier_id: z.string().min(1, "Supplier required"),
  purchase_id: z.string().optional().or(z.literal("")),
  amount: z.number().min(0.01, "Amount > 0"),
  payment_mode: z.enum(["cash", "upi", "bank", "credit"]),
  bill_date: z.string().min(1, "Date required"),
  reference: z.string().max(30).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type PaymentValues = z.infer<typeof paymentSchema>;
