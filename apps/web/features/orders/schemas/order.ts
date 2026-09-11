import * as z from "zod";

export const orderChannelOptions = [
  { label: "Dine-in", value: "dine_in" },
  { label: "Takeaway", value: "takeaway" },
  { label: "Delivery", value: "delivery" },
  { label: "Zomato", value: "zomato" },
  { label: "Swiggy", value: "swiggy" },
  { label: "Online", value: "own_online" },
] as const;

export const createOrderSchema = z.object({
  channel: z.enum(["dine_in", "takeaway", "delivery", "zomato", "swiggy", "own_online"]),
  table_id: z.string().optional(),
  occupancy_group_id: z.string().optional(),
  customer_name: z.string().max(60).optional(),
  customer_phone: z.string().max(15).optional(),
  external_ref: z.string().max(40).optional(),
});

export const addItemSchema = z.object({
  menu_item_id: z.string().min(1, "Item is required"),
  variant_id: z.string().optional(),
  modifier_ids: z.array(z.string()).optional(),
  qty: z.number().int().min(1).max(50),
  instructions: z.string().max(200).optional(),
});

export type CreateOrderValues = z.infer<typeof createOrderSchema>;
export type AddItemValues = z.infer<typeof addItemSchema>;
