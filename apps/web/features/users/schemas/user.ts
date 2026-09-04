import * as z from "zod";
import { POS_ROLES } from "@/config/roles";

const roleValues = POS_ROLES.map((r) => r.value) as [string, ...string[]];

export const userSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(1, "Phone number is required"),
  role: z.enum(roleValues, { error: "Please select a role" }),
  status: z.string().min(1, "Please select a status"),
});

export type UserFormValues = z.infer<typeof userSchema>;
