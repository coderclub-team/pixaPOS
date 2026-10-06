/**
 * Default subscription plans — the single source of truth for plan limits,
 * feature flags and marketing copy. Seeded into `saas_plans` (owner-editable
 * afterwards) and imported by the entitlement service as a fallback when a
 * row is missing.
 *
 * Product limits are counts. Infrastructure limits use canonical units:
 *   storage/transfer/writtenData → bytes
 *   compute                      → CU-hours
 *   functions                    → invocations per month
 * A `null` limit means "custom/negotiated" (only meaningful for the Custom
 * plan); it is never treated as unlimited in enforcement without an override.
 */

export type ResourceLimit =
  | "outlets"
  | "users"
  | "devices"
  | "orders"
  | "products"
  | "customers"
  | "databaseStorage"
  | "objectStorage"
  | "compute"
  | "functions"
  | "transfer"
  | "writtenData";

export type Feature =
  | "multiOutlet"
  | "centralMenu"
  | "onlineOrdering"
  | "advancedReports"
  | "chainDashboard"
  | "api"
  | "customDomain";

export const RESOURCE_LIMITS: ResourceLimit[] = [
  "outlets",
  "users",
  "devices",
  "orders",
  "products",
  "customers",
  "databaseStorage",
  "objectStorage",
  "compute",
  "functions",
  "transfer",
  "writtenData",
];

export const FEATURES: Feature[] = [
  "multiOutlet",
  "centralMenu",
  "onlineOrdering",
  "advancedReports",
  "chainDashboard",
  "api",
  "customDomain",
];

/** Monthly-resetting resources; everything else is persistent. */
export const MONTHLY_RESOURCES: ResourceLimit[] = [
  "orders",
  "compute",
  "functions",
  "transfer",
  "writtenData",
];

export const MB = 1024 * 1024;
export const GB = 1024 * MB;

export type LimitMap = Record<ResourceLimit, number | null>;
export type Flags = Record<Feature, boolean>;

export type DefaultPlan = {
  id: string;
  name: string;
  tagline: string;
  monthlyPaise: number | null;
  annualDiscountPct: number;
  limits: LimitMap;
  flags: Flags;
  /** Marketing bullet list (shown on the landing/billing catalog). */
  features: string[];
  /** Customer-facing one-line storage summary. */
  storageLabel: string;
  sortOrder: number;
  isActive: boolean;
};

export const DEFAULT_PLANS: DefaultPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For a single outlet",
    monthlyPaise: 49900,
    annualDiscountPct: 0,
    limits: {
      outlets: 1,
      users: 2,
      devices: 2,
      orders: 500,
      products: 100,
      customers: 250,
      databaseStorage: 250 * MB,
      objectStorage: 250 * MB,
      compute: 20,
      functions: 50_000,
      transfer: 1 * GB,
      writtenData: 100 * MB,
    },
    flags: {
      multiOutlet: true,
      centralMenu: true,
      onlineOrdering: true,
      advancedReports: true,
      chainDashboard: true,
      api: true,
      customDomain: true,
    },
    features: [
      "1 outlet",
      "2 users",
      "2 devices",
      "500 orders/month",
      "500 MB storage",
      "All features included",
    ],
    storageLabel: "500 MB storage",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing restaurants and small groups",
    monthlyPaise: 199900,
    annualDiscountPct: 20,
    limits: {
      outlets: 5,
      users: 25,
      devices: 20,
      orders: 10_000,
      products: 2_000,
      customers: 10_000,
      databaseStorage: 2 * GB,
      objectStorage: 5 * GB,
      compute: 200,
      functions: 2_000_000,
      transfer: 50 * GB,
      writtenData: 2 * GB,
    },
    flags: {
      multiOutlet: true,
      centralMenu: true,
      onlineOrdering: true,
      advancedReports: true,
      chainDashboard: true,
      api: true,
      customDomain: true,
    },
    features: [
      "Up to 5 outlets",
      "25 users",
      "20 devices",
      "10,000 orders/month",
      "7 GB combined storage",
      "All features included",
    ],
    storageLabel: "7 GB combined storage",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "For chains, franchises and enterprise",
    monthlyPaise: null,
    annualDiscountPct: 0,
    limits: {
      outlets: 50,
      users: 300,
      devices: 200,
      orders: 500_000,
      products: 50_000,
      customers: 500_000,
      databaseStorage: 50 * GB,
      objectStorage: 100 * GB,
      compute: 2_000,
      functions: 50_000_000,
      transfer: 500 * GB,
      writtenData: 50 * GB,
    },
    flags: {
      multiOutlet: true,
      centralMenu: true,
      onlineOrdering: true,
      advancedReports: true,
      chainDashboard: true,
      api: true,
      customDomain: true,
    },
    features: [
      "Custom outlets",
      "Custom users",
      "Custom storage",
      "Custom infrastructure",
      "API access",
      "Enterprise support",
    ],
    storageLabel: "Custom storage",
    sortOrder: 3,
    isActive: true,
  },
];

export const DEFAULT_PLAN_ID = "starter";

export function planById(id: string): DefaultPlan | undefined {
  return DEFAULT_PLANS.find((p) => p.id === id);
}

/** Pure effective-limits resolver (defaults + organization overrides). */
export function resolveLimits(planId: string, overrides?: Partial<LimitMap> | null): LimitMap {
  const base = (planById(planId) ?? planById(DEFAULT_PLAN_ID))!.limits;
  return { ...base, ...overrides };
}

/* ------------------------------------------------------------------ */
/* Infrastructure cost model (internal only — never shown to customers). */
/* Neon Launch-plan rates in USD. Written data is folded into storage.   */
/* ------------------------------------------------------------------ */

export const NEON_LAUNCH_RATES = {
  computeUsdPerCuHour: 0.106,
  databaseStorageUsdPerGbMonth: 0.35,
  objectStorageUsdPerGbMonth: 0.023,
  transferIncludedGb: 500,
  transferUsdPerGb: 0.1,
  functionsUsdPerMillion: 0.6,
} as const;

const BYTES_PER_GB = 1024 * 1024 * 1024;

export type CostLine = {
  resource: ResourceLimit;
  limit: number | null;
  rateLabel: string;
  costUsd: number;
  note?: string;
};

/** Cost of a plan if every infrastructure limit were fully consumed. */
export function estimateInfraCost(limits: LimitMap): { lines: CostLine[]; totalUsd: number } {
  const r = NEON_LAUNCH_RATES;
  const gb = (bytes: number) => bytes / BYTES_PER_GB;
  const lines: CostLine[] = [
    {
      resource: "compute",
      limit: limits.compute,
      rateLabel: `$${r.computeUsdPerCuHour}/CU-h`,
      costUsd: limits.compute === null ? 0 : limits.compute * r.computeUsdPerCuHour,
    },
    {
      resource: "databaseStorage",
      limit: limits.databaseStorage,
      rateLabel: `$${r.databaseStorageUsdPerGbMonth}/GB-month`,
      costUsd:
        limits.databaseStorage === null
          ? 0
          : gb(limits.databaseStorage) * r.databaseStorageUsdPerGbMonth,
    },
    {
      resource: "objectStorage",
      limit: limits.objectStorage,
      rateLabel: `$${r.objectStorageUsdPerGbMonth}/GB-month`,
      costUsd:
        limits.objectStorage === null ? 0 : gb(limits.objectStorage) * r.objectStorageUsdPerGbMonth,
    },
    {
      resource: "transfer",
      limit: limits.transfer,
      rateLabel: `${r.transferIncludedGb} GB incl, then $${r.transferUsdPerGb}/GB`,
      costUsd:
        limits.transfer === null
          ? 0
          : Math.max(0, gb(limits.transfer) - r.transferIncludedGb) * r.transferUsdPerGb,
    },
    {
      resource: "functions",
      limit: limits.functions,
      rateLabel: `$${r.functionsUsdPerMillion}/M invocations`,
      costUsd:
        limits.functions === null ? 0 : (limits.functions / 1_000_000) * r.functionsUsdPerMillion,
    },
    {
      resource: "writtenData",
      limit: limits.writtenData,
      rateLabel: "Folded into storage",
      costUsd: 0,
      note: "No longer a separate charge",
    },
  ];
  const totalUsd = lines.reduce((s, l) => s + l.costUsd, 0);
  return { lines, totalUsd };
}
