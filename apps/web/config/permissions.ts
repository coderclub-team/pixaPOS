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
} as const;

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
  ],
  "org:cashier": [
    POS_PERMISSIONS.tablesOperate,
    POS_PERMISSIONS.ordersManage,
    POS_PERMISSIONS.ordersView,
    POS_PERMISSIONS.reportsView,
  ],
  "org:waiter": [
    POS_PERMISSIONS.tablesOperate,
    POS_PERMISSIONS.ordersManage,
    POS_PERMISSIONS.ordersView,
  ],
  "org:kitchen": [POS_PERMISSIONS.ordersView],
  "org:accountant": [POS_PERMISSIONS.reportsView, POS_PERMISSIONS.ordersView],
};
