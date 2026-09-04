import * as z from "zod";

export const tableStatusOptions = [
  { label: "Available", value: "available" },
  { label: "Occupied", value: "occupied" },
  { label: "Reserved", value: "reserved" },
  { label: "Maintenance", value: "maintenance" },
] as const;

export const tableShapeOptions = [
  { label: "Square", value: "square" },
  { label: "Round", value: "round" },
  { label: "Rectangle", value: "rectangle" },
] as const;

export const tableSchema = z.object({
  floor_id: z.string().min(1, "Floor is required"),
  number: z
    .string()
    .min(1, "Table number required")
    .max(10, "Max 10 chars")
    .regex(/^[A-Za-z0-9-_]+$/, "Alphanumeric with -/_ only"),
  code: z
    .string()
    .min(2, "Code min 2 chars")
    .max(20, "Max 20 chars")
    .regex(/^[A-Za-z0-9-_]+$/, "Alphanumeric with -/_ only"),
  capacity: z.number().int().min(1, "Capacity min 1").max(20, "Max 20 covers"),
  shape: z.enum(["square", "round", "rectangle"]),
  status: z.enum(["available", "occupied", "reserved", "maintenance"]),
  sort_order: z.number().int().min(0).max(100),
  is_active: z.boolean(),
});

export type TableValues = z.infer<typeof tableSchema>;
