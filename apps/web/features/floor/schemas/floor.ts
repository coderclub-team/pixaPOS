import * as z from "zod";

export const floorSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(40, "Name must be at most 40 characters"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Za-z0-9-_]+$/, "Code must be alphanumeric with - or _"),
  description: z.string().max(200, "Description too long").optional().or(z.literal("")),
  level: z.number().int().min(-5, "Level min -5").max(50, "Level max 50"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(1000, "Capacity too large"),
  sort_order: z.number().int().min(0).max(100),
  is_active: z.boolean(),
  is_outdoor: z.boolean().optional(),
});

export type FloorValues = z.infer<typeof floorSchema>;
