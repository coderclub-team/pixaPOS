import * as z from "zod";

export const recipeIngredientSchema = z.object({
  material_id: z.string().min(1, "Material required"),
  qty: z.number().min(0.01, "Qty min 0.01"),
  unit: z.string().min(1),
  wastage_percent: z.number().min(0).max(100).optional(),
});

export const recipeSchema = z.object({
  name: z.string().min(2).max(50),
  yields: z.number().int().min(1),
  ingredients: z.array(recipeIngredientSchema).min(1, "At least one ingredient"),
  selling_price: z.number().min(0).optional(),
  is_active: z.boolean(),
});

export type RecipeValues = z.infer<typeof recipeSchema>;
