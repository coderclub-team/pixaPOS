export const POS_ROLES = [
  { label: "Owner", value: "org:admin", description: "Full access — billing, org management" },
  {
    label: "Manager",
    value: "org:manager",
    description: "Manage outlet, floors, tables, menu, staff, reports",
  },
  { label: "Cashier", value: "org:cashier", description: "Billing, orders, table status" },
  {
    label: "Waiter",
    value: "org:waiter",
    description: "Take orders, update own orders, operate tables",
  },
  { label: "Kitchen", value: "org:kitchen", description: "KOT — view and update kitchen status" },
  {
    label: "Accountant",
    value: "org:accountant",
    description: "View reports and orders, no mutations",
  },
] as const;

export type PosRoleValue = (typeof POS_ROLES)[number]["value"];

export const POS_ROLE_OPTIONS = POS_ROLES.map((r) => ({ label: r.label, value: r.value }));
