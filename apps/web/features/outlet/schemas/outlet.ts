import * as z from "zod";

export const outletTypeOptions = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Cloud Kitchen", value: "cloud_kitchen" },
  { label: "QSR", value: "qsr" },
  { label: "Fine Dine", value: "fine_dine" },
  { label: "Cafe", value: "cafe" },
  { label: "Bakery", value: "bakery" },
] as const;

export const basicInformationSchema = z.object({
  name: z.string().min(2, "Outlet name must be at least 2 characters"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must be at most 20 characters"),
  alias: z.string().optional(),
  type: z.string().min(1, "Please select outlet type"),
  logo_url: z.union([z.string(), z.array(z.instanceof(File))]).optional(),
  is_active: z.boolean(),
});

export const contactSchema = z.object({
  phone: z.string().min(10, "Phone must be at least 10 digits").max(15, "Phone too long"),
  alternate_phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
});

export const addressSchema = z.object({
  address_line_1: z.string().min(5, "Address line 1 must be at least 5 characters"),
  address_line_2: z.string().optional().or(z.literal("")),
  locality: z.string().min(2, "Locality required"),
  city: z.string().min(2, "City required"),
  district: z.string().optional().or(z.literal("")),
  state: z.string().min(2, "State required"),
  country: z.string().min(2, "Country required"),
  postal_code: z.string().regex(/^[0-9]{4,10}$/, "Postal code must be 4-10 digits"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const gstSchema = z
  .object({
    gst_registered: z.boolean(),
    gstin: z.string().optional(),
    legal_name: z.string().optional(),
    pan: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.gst_registered) {
      if (
        !data.gstin ||
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.gstin)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valid GSTIN required (15 chars)",
          path: ["gstin"],
        });
      }
      if (!data.legal_name || data.legal_name.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Legal name required when GST registered",
          path: ["legal_name"],
        });
      }
      if (!data.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(data.pan)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid PAN required", path: ["pan"] });
      }
    }
  });

export const fssaiSchema = z.object({
  fssai_number: z
    .string()
    .regex(/^[0-9]{14}$/, "FSSAI must be 14 digits")
    .optional()
    .or(z.literal("")),
});

export const businessDetailsSchema = z.object({
  legal_name: z.string().min(2, "Legal name required"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Valid PAN required (e.g., ABCDE1234F)"),
  gstin: z.string().optional(),
  fssai_number: z.string().optional(),
});

export const timezoneSchema = z.object({
  currency: z.string().min(3, "Currency required"),
  timezone: z.string().min(1, "Timezone required"),
  locale: z.string().min(2, "Locale required"),
  is_active: z.boolean(),
});

export type BasicInformationValues = z.infer<typeof basicInformationSchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type AddressValues = z.infer<typeof addressSchema>;
export type GSTValues = z.infer<typeof gstSchema>;
export type FSSAIValues = z.infer<typeof fssaiSchema>;
export type BusinessDetailsValues = z.infer<typeof businessDetailsSchema>;
export type TimezoneValues = z.infer<typeof timezoneSchema>;

export const outletSchema = z.object({
  id: z.string().optional(),
  organization_id: z.string().optional(),
  name: z.string().min(2),
  code: z.string().min(2),
  alias: z.string().optional(),
  type: z.string().min(1),
  logo_url: z.union([z.string(), z.array(z.instanceof(File))]).optional(),
  phone: z.string().min(10),
  alternate_phone: z.string().optional(),
  email: z.string().email(),
  website: z.string().optional(),
  whatsapp: z.string().optional(),
  address_line_1: z.string().min(5),
  address_line_2: z.string().optional(),
  locality: z.string().min(2),
  city: z.string().min(2),
  district: z.string().optional(),
  state: z.string().min(2),
  country: z.string().min(2),
  postal_code: z.string().regex(/^[0-9]{4,10}$/),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  gst_registered: z.boolean().default(false),
  gstin: z.string().optional(),
  legal_name: z.string().optional(),
  pan: z.string().optional(),
  fssai_number: z.string().optional(),
  currency: z.string().default("INR"),
  timezone: z.string().default("Asia/Kolkata"),
  locale: z.string().default("en-IN"),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type OutletFormValues = z.infer<typeof outletSchema>;
