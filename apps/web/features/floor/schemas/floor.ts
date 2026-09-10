import * as z from "zod";

export const floorSchema = z.object({
  name: z.string().min(2, "Name min 2 chars").max(50),
  code: z
    .string()
    .min(1, "Code required")
    .max(10)
    .regex(/^[A-Za-z0-9-_]+$/, "Alphanumeric with -/_ only"),
  description: z.string().max(200).optional().or(z.literal("")),
  level: z.number().int().min(-5).max(100),
  capacity: z.number().int().min(1).max(1000),
  sort_order: z.number().int().min(0).max(100),
  is_active: z.boolean(),
  is_outdoor: z.boolean().optional(),
  // Geometry
  width_mm: z.number().min(1000).max(100000).optional(),
  height_mm: z.number().min(1000).max(100000).optional(),
  grid_size_mm: z.number().min(10).max(1000).optional(),
  background_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional().or(z.literal("")),
  background_image_url: z.string().url().optional().or(z.literal("")),
});

export type FloorValues = z.infer<typeof floorSchema>;
