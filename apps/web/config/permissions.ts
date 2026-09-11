export const POS_PERMISSIONS = {
  usersManage: "org:users:manage",
  outletManage: "org:outlet:manage",
  floorsManage: "org:floors:manage",
  tablesManage: "org:tables:manage",
  tablesOperate: "org:tables:operate",
  ordersManage: "org:orders:manage",
  ordersView: "org:orders:view",
  menuManage: "org:menu:manage",
  reportsView: "org:reports:view",
  sysMembershipsManage: "org:sys_memberships:manage",
  sysProfileManage: "org:sys_profile:manage",
  inventoryManage: "org:inventory:manage",
  inventoryView: "org:inventory:view",
  suppliersManage: "org:suppliers:manage",
  purchasesManage: "org:purchases:manage",
  recipesManage: "org:recipes:manage",
  wasteManage: "org:waste:manage",
} as const;

export type PosPermissionKey = (typeof POS_PERMISSIONS)[keyof typeof POS_PERMISSIONS];

/**
 * Human-readable metadata for every POS permission. The `key` must match a value
 * in POS_PERMISSIONS and an existing Clerk organization permission for it to be
 * assignable to a role/membership.
 */
export const POS_PERMISSION_META: { key: PosPermissionKey; label: string; group: string }[] = [
  { key: POS_PERMISSIONS.usersManage, label: "Manage users", group: "Team" },
  { key: POS_PERMISSIONS.sysMembershipsManage, label: "Manage memberships", group: "Team" },
  { key: POS_PERMISSIONS.sysProfileManage, label: "Manage organization profile", group: "Team" },
  { key: POS_PERMISSIONS.outletManage, label: "Manage outlet", group: "Outlet" },
  { key: POS_PERMISSIONS.floorsManage, label: "Manage floors", group: "Tables" },
  { key: POS_PERMISSIONS.tablesManage, label: "Manage tables", group: "Tables" },
  { key: POS_PERMISSIONS.tablesOperate, label: "Operate tables", group: "Tables" },
  { key: POS_PERMISSIONS.ordersManage, label: "Manage orders", group: "Orders" },
  { key: POS_PERMISSIONS.ordersView, label: "View orders", group: "Orders" },
  { key: POS_PERMISSIONS.menuManage, label: "Manage menu", group: "Menu" },
  { key: POS_PERMISSIONS.reportsView, label: "View reports", group: "Reports" },
  { key: POS_PERMISSIONS.inventoryManage, label: "Manage inventory", group: "Inventory" },
  { key: POS_PERMISSIONS.inventoryView, label: "View inventory", group: "Inventory" },
  { key: POS_PERMISSIONS.suppliersManage, label: "Manage suppliers", group: "Inventory" },
  { key: POS_PERMISSIONS.purchasesManage, label: "Manage purchases", group: "Inventory" },
  { key: POS_PERMISSIONS.recipesManage, label: "Manage recipes", group: "Inventory" },
  { key: POS_PERMISSIONS.wasteManage, label: "Manage waste", group: "Inventory" },
];

// Role -> permissions mapping (for docs / future Clerk setup)
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  "org:admin": Object.values(POS_PERMISSIONS),
  "org:manager": [
    POS_PERMISSIONS.usersManage,
    POS_PERMISSIONS.outletManage,
    POS_PERMISSIONS.floorsManage,
    POS_PERMISSIONS.tablesManage,
    POS_PERMISSIONS.tablesOperate,
    POS_PERMISSIONS.ordersManage,
    POS_PERMISSIONS.menuManage,
    POS_PERMISSIONS.reportsView,
    POS_PERMISSIONS.inventoryManage,
    POS_PERMISSIONS.suppliersManage,
    POS_PERMISSIONS.purchasesManage,
    POS_PERMISSIONS.recipesManage,
    POS_PERMISSIONS.wasteManage,
  ],
  "org:cashier": [
    POS_PERMISSIONS.tablesOperate,
    POS_PERMISSIONS.ordersManage,
    POS_PERMISSIONS.ordersView,
    POS_PERMISSIONS.reportsView,
    POS_PERMISSIONS.inventoryView,
  ],
  "org:waiter": [
    POS_PERMISSIONS.tablesOperate,
    POS_PERMISSIONS.ordersManage,
    POS_PERMISSIONS.ordersView,
  ],
  "org:kitchen": [
    POS_PERMISSIONS.ordersView,
    POS_PERMISSIONS.inventoryView,
    POS_PERMISSIONS.wasteManage,
  ],
  "org:accountant": [
    POS_PERMISSIONS.reportsView,
    POS_PERMISSIONS.ordersView,
    POS_PERMISSIONS.inventoryView,
    POS_PERMISSIONS.purchasesManage,
  ],
};
