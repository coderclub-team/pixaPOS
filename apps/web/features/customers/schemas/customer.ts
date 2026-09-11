import * as z from "zod";

export const addressSchema = z.object({
  label: z.enum(["home", "work", "other"]),
  line1: z.string().min(5, "Address line min 5 chars").max(120),
  line2: z.string().max(120).optional(),
  locality: z.string().min(1, "Locality required").max(80),
  city: z.string().min(1, "City required").max(60),
  state: z.string().min(1, "State required").max(60),
  postal_code: z.string().min(3, "Postal code required").max(12),
  country: z.string().min(2).max(4),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_primary: z.boolean().optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Customer name required").max(80),
  phone: z.string().min(10, "Phone min 10 digits").max(15),
  alternate_phone: z.string().max(15).optional(),
  email: z.string().email("Invalid email").max(80).optional().or(z.literal("")),
  tags: z.array(z.string().max(30)).max(20).optional(),
  notes: z.string().max(500).optional(),
  is_active: z.boolean(),
  addresses: z.array(addressSchema).max(10).optional(),
});

export type CustomerValues = z.infer<typeof customerSchema>;
