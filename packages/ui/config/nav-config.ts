import { NavGroup } from "../types";

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 * Items are organized into groups, each rendered with a SidebarGroupLabel.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard/overview",
        icon: "dashboard",
        isActive: false,
        shortcut: ["d", "d"],
        items: [],
      },
      {
        title: "Workspaces",
        url: "/dashboard/workspaces",
        icon: "workspace",
        isActive: false,
        items: [],
      },
      {
        title: "Teams",
        url: "/dashboard/workspaces/team",
        icon: "teams",
        isActive: false,
        items: [],
        access: { requireOrg: true },
      },

      {
        title: "Users",
        url: "/dashboard/users",
        icon: "teams",
        shortcut: ["u", "u"],
        isActive: false,
        items: [],
        access: { requireOrg: true, permission: "org:sys_memberships:manage" },
      },
      {
        title: "Kanban",
        url: "/dashboard/kanban",
        icon: "kanban",
        shortcut: ["k", "k"],
        isActive: false,
        items: [],
      },
      {
        title: "Chat",
        url: "/dashboard/chat",
        icon: "chat",
        shortcut: ["c", "c"],
        isActive: false,
        items: [],
      },
      {
        title: "AI Chat",
        url: "/dashboard/ai-chat",
        icon: "sparkles",
        shortcut: ["a", "i"],
        isActive: false,
        items: [],
      },
    ],
  },
  {
    label: "Elements",
    items: [
      {
        title: "Forms",
        url: "#",
        icon: "forms",
        isActive: true,
        items: [
          {
            title: "Basic Form",
            url: "/dashboard/forms/basic",
            icon: "forms",
            shortcut: ["f", "f"],
          },
          {
            title: "Multi-Step Form",
            url: "/dashboard/forms/multi-step",
            icon: "forms",
          },
          {
            title: "Sheet & Dialog",
            url: "/dashboard/forms/sheet-form",
            icon: "forms",
          },
          {
            title: "Advanced Patterns",
            url: "/dashboard/forms/advanced",
            icon: "forms",
          },
        ],
      },
      {
        title: "React Query",
        url: "/dashboard/react-query",
        icon: "code",
        isActive: false,
        items: [],
      },
      {
        title: "Icons",
        url: "/dashboard/elements/icons",
        icon: "palette",
        isActive: false,
        items: [],
      },
    ],
  },
  {
    label: "Outlet",
    items: [
      {
        title: "Profile",
        url: "#",
        icon: "user",
        isActive: true,
        items: [
          {
            title: "Outlet Profile",
            url: "/dashboard/settings/outlet/profile",
            icon: "user",
            shortcut: ["o", "o"],
            access: { requireOrg: true, permission: "org:sys_profile:manage" },
          },
        ],
      },
      {
        title: "Setup",
        url: "#",
        icon: "settings",
        isActive: true,
        items: [
          {
            title: "Business Hours",
            url: "/dashboard/settings/outlet/operations/business-hours",
            icon: "clock",
            shortcut: ["o", "h"],
          },
          {
            title: "Order Settings",
            url: "/dashboard/settings/outlet/operations/order-settings",
            icon: "adjustments",
            shortcut: ["o", "o"],
          },
          {
            title: "Preferences",
            url: "/dashboard/settings/outlet/operations/timezone",
            icon: "clock",
            shortcut: ["o", "z"],
          },
          {
            title: "Billing Templates",
            url: "/dashboard/settings/outlet/billing/invoice",
            icon: "billing",
            shortcut: ["o", "i"],
          },
        ],
      },
      {
        title: "Floors & Tables",
        url: "#",
        icon: "layers",
        isActive: true,
        items: [
          {
            title: "Floors",
            url: "/dashboard/settings/outlet/floors",
            icon: "layers",
            shortcut: ["o", "f", "l"],
            access: { requireOrg: true },
          },
          {
            title: "Tables",
            url: "/dashboard/settings/outlet/tables",
            icon: "table",
            shortcut: ["o", "t"],
            access: { requireOrg: true },
          },
          {
            title: "Floor View",
            url: "/dashboard/settings/outlet/floor-plan",
            icon: "layers",
            shortcut: ["o", "v"],
            access: { requireOrg: true },
          },
        ],
      },
    ],
  },
  {
    label: "Menu",
    items: [
      {
        title: "Menu",
        url: "#",
        icon: "pizza",
        isActive: true,
        items: [
          {
            title: "Categories",
            url: "/dashboard/menu/categories",
            icon: "layers",
            shortcut: ["m", "c"],
            access: { requireOrg: true },
          },
          {
            title: "Menu Items",
            url: "/dashboard/menu/items",
            icon: "pizza",
            shortcut: ["m", "i"],
            access: { requireOrg: true },
          },
        ],
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        title: "Masters",
        url: "#",
        icon: "warehouse",
        isActive: true,
        items: [
          {
            title: "Raw Materials",
            url: "/dashboard/inventory/raw-materials",
            icon: "package",
            shortcut: ["i", "r"],
            access: { requireOrg: true },
          },
          {
            title: "Recipes",
            url: "/dashboard/inventory/recipes",
            icon: "recipe",
            shortcut: ["i", "c"],
            access: { requireOrg: true },
          },
          {
            title: "Suppliers",
            url: "/dashboard/inventory/suppliers",
            icon: "supplier",
            shortcut: ["i", "s"],
            access: { requireOrg: true },
          },
        ],
      },
      {
        title: "Buying",
        url: "#",
        icon: "cart",
        isActive: true,
        items: [
          {
            title: "Purchase Orders",
            url: "/dashboard/inventory/purchase-orders",
            icon: "cart",
            shortcut: ["i", "p"],
            access: { requireOrg: true },
          },
          {
            title: "Purchase Bills",
            url: "/dashboard/inventory/purchases",
            icon: "fileTypePdf",
            shortcut: ["i", "b"],
            access: { requireOrg: true },
          },
          {
            title: "Purchase Returns",
            url: "/dashboard/inventory/returns",
            icon: "clipboardList",
            shortcut: ["i", "e"],
            access: { requireOrg: true },
          },
          {
            title: "Vendor Credits",
            url: "/dashboard/inventory/supplier-credits",
            icon: "badgeCheck",
            shortcut: ["i", "d"],
            access: { requireOrg: true },
          },
          {
            title: "Payments",
            url: "/dashboard/inventory/payments",
            icon: "billing",
            shortcut: ["i", "m"],
            access: { requireOrg: true },
          },
        ],
      },
      {
        title: "Reports",
        url: "#",
        icon: "warehouse",
        isActive: true,
        items: [
          {
            title: "Stock History",
            url: "/dashboard/inventory/stock",
            icon: "warehouse",
            shortcut: ["i", "h"],
            access: { requireOrg: true },
          },
          {
            title: "Payables Ledger",
            url: "/dashboard/inventory/supplier-ledger",
            icon: "table",
            shortcut: ["i", "o"],
            access: { requireOrg: true },
          },
          {
            title: "Waste Log",
            url: "/dashboard/inventory/waste",
            icon: "trash",
            shortcut: ["i", "w"],
            access: { requireOrg: true },
          },
        ],
      },
    ],
  },
  {
    label: "",
    items: [
      {
        title: "Pro",
        url: "#",
        icon: "pro",
        isActive: false,
        items: [
          {
            title: "Exclusive",
            url: "/dashboard/exclusive",
            icon: "exclusive",
            shortcut: ["e", "e"],
          },
        ],
      },
      {
        title: "Account",
        url: "#",
        icon: "account",
        isActive: true,
        items: [
          {
            title: "Profile",
            url: "/dashboard/profile",
            icon: "profile",
            shortcut: ["m", "m"],
          },
          {
            title: "Notifications",
            url: "/dashboard/notifications",
            icon: "notification",
            shortcut: ["n", "n"],
          },
          {
            title: "Billing",
            url: "/dashboard/billing",
            icon: "billing",
            shortcut: ["b", "b"],
            access: { requireOrg: true },
          },
          {
            title: "Login",
            shortcut: ["l", "l"],
            url: "/",
            icon: "login",
          },
        ],
      },
    ],
  },
];
