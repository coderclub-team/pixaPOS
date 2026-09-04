import * as z from "zod";

export const supplierSchema = z.object({
  name: z.string().min(2, "Supplier name required").max(50),
  contact_person: z.string().optional().or(z.literal("")),
  phone: z.string().min(10, "Phone min 10 digits").max(15),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  gstin: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type SupplierValues = z.infer<typeof supplierSchema>;
