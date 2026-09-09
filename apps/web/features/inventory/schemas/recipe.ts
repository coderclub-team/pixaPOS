import * as z from "zod";

export const recipeIngredientSchema = z.object({
  material_id: z.string().min(1, "Material required"),
  qty: z.number().min(0.01, "Qty min 0.01"),
  unit: z.string().min(1),
  wastage_percent: z.number().min(0).max(100).optional(),
  step_no: z.number().int().min(1).optional(),
});

export const recipeStepSchema = z.object({
  instruction: z.string().min(2, "Instruction required").max(500),
  vessel: z
    .enum([
      "kadai",
      "handi",
      "tawa",
      "pressure_cooker",
      "oven",
      "tandoor",
      "steamer",
      "wok",
      "pan",
      "pot",
      "grill",
      "fryer",
      "other",
    ])
    .optional(),
  vessel_note: z.string().max(100).optional().or(z.literal("")),
  temperature_c: z.number().min(0).max(300).optional(),
  heat_level: z.enum(["low", "medium", "high"]).optional().or(z.literal("")),
  duration_min: z.number().min(0).max(1440).optional(),
  is_optional: z.boolean().optional(),
});

export const recipeSchema = z.object({
  name: z.string().min(2).max(50),
  yields: z.number().int().min(1),
  yield_unit: z.enum(["serves", "plates", "kg", "l", "pcs"]).optional().or(z.literal("")),
  ingredients: z.array(recipeIngredientSchema).min(1, "At least one ingredient"),
  steps: z.array(recipeStepSchema).max(20, "Max 20 steps").optional(),
  selling_price: z.number().min(0).optional(),
  prep_time_min: z.number().min(0).optional(),
  cook_time_min: z.number().min(0).optional(),
  plating_notes: z.string().max(500).optional().or(z.literal("")),
  garnish: z.string().max(200).optional().or(z.literal("")),
  serving_vessel: z.string().max(100).optional().or(z.literal("")),
  menu_item_id: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type RecipeValues = z.infer<typeof recipeSchema>;
