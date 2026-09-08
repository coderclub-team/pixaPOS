import * as z from "zod";

export const menuCategorySchema = z.object({
  name: z.string().min(2, "Name required").max(30),
  description: z.string().max(500).optional().or(z.literal("")),
  image_url: z.string().url().optional().or(z.literal("")),
  parent_id: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});
export type MenuCategoryValues = z.infer<typeof menuCategorySchema>;
