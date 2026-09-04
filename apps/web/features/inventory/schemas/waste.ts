import * as z from "zod";

export const wasteSchema = z.object({
  material_id: z.string().min(1, "Material required"),
  qty: z.number().min(0.01),
  reason: z.enum(["spoilage", "expired", "overproduction", "trimming", "spillage", "other"]),
  notes: z.string().max(200).optional().or(z.literal("")),
});

export type WasteValues = z.infer<typeof wasteSchema>;
