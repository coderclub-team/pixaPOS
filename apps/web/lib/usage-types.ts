/**
 * Pure usage/limit types + formatting shared by server services and client
 * usage UIs. No DB imports — safe for the browser bundle.
 */
import type { ResourceLimit } from "@pixa/db";

export type { ResourceLimit };

export type UsageMap = Record<ResourceLimit, number>;

/** Ordered resource metadata for rendering. */
export type ResourceMeta = {
  key: ResourceLimit;
  label: string;
  short: string;
  /** true = infrastructure metric, hidden from customers. */
  infra: boolean;
  /** true = resets every billing period. */
  monthly: boolean;
  /** how to render the number. */
  unit: "count" | "bytes" | "cuHours";
};

export const RESOURCE_ORDER: ResourceLimit[] = [
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

export const RESOURCE_META: Record<ResourceLimit, ResourceMeta> = {
  outlets: {
    key: "outlets",
    label: "Outlets",
    short: "Outlets",
    infra: false,
    monthly: false,
    unit: "count",
  },
  users: {
    key: "users",
    label: "Users",
    short: "Users",
    infra: false,
    monthly: false,
    unit: "count",
  },
  devices: {
    key: "devices",
    label: "Devices",
    short: "Devices",
    infra: false,
    monthly: false,
    unit: "count",
  },
  orders: {
    key: "orders",
    label: "Orders / month",
    short: "Orders",
    infra: false,
    monthly: true,
    unit: "count",
  },
  products: {
    key: "products",
    label: "Products",
    short: "Products",
    infra: false,
    monthly: false,
    unit: "count",
  },
  customers: {
    key: "customers",
    label: "Customers",
    short: "Customers",
    infra: false,
    monthly: false,
    unit: "count",
  },
  databaseStorage: {
    key: "databaseStorage",
    label: "Database storage",
    short: "Database",
    infra: true,
    monthly: false,
    unit: "bytes",
  },
  objectStorage: {
    key: "objectStorage",
    label: "Object storage",
    short: "Storage",
    infra: true,
    monthly: false,
    unit: "bytes",
  },
  compute: {
    key: "compute",
    label: "Compute",
    short: "Compute",
    infra: true,
    monthly: true,
    unit: "cuHours",
  },
  functions: {
    key: "functions",
    label: "Function calls",
    short: "Functions",
    infra: true,
    monthly: true,
    unit: "count",
  },
  transfer: {
    key: "transfer",
    label: "Data transfer",
    short: "Transfer",
    infra: true,
    monthly: true,
    unit: "bytes",
  },
  writtenData: {
    key: "writtenData",
    label: "Written data",
    short: "Writes",
    infra: true,
    monthly: true,
    unit: "bytes",
  },
};

export function emptyUsage(): UsageMap {
  return RESOURCE_ORDER.reduce((acc, r) => {
    acc[r] = 0;
    return acc;
  }, {} as UsageMap);
}

const KB = 1024;
const MIB = KB * 1024;
const GIB = MIB * 1024;

function trimZeros(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export function formatBytes(bytes: number | null | undefined): string {
  const n = bytes ?? 0;
  if (n < KB) return `${n} B`;
  if (n < MIB) return `${trimZeros(n / KB, 1)} KB`;
  if (n < GIB) return `${trimZeros(n / MIB, 1)} MB`;
  return `${trimZeros(n / GIB, 2)} GB`;
}

export function formatNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-IN");
}

export function formatValue(meta: ResourceMeta, value: number | null): string {
  if (value === null) return "Custom";
  switch (meta.unit) {
    case "bytes":
      return formatBytes(value);
    case "cuHours":
      return `${formatNumber(value)} CU-h`;
    default:
      return formatNumber(value);
  }
}

export type Severity = "ok" | "info" | "warning" | "critical" | "blocked";

export type UsageBarData = {
  resource: ResourceLimit;
  meta: ResourceMeta;
  current: number;
  limit: number | null;
  pct: number;
  severity: Severity;
  currentLabel: string;
  limitLabel: string;
};

export function buildBar(
  resource: ResourceLimit,
  current: number,
  limit: number | null,
): UsageBarData {
  const meta = RESOURCE_META[resource];
  const c = current ?? 0;
  if (limit === null || limit <= 0) {
    return {
      resource,
      meta,
      current: c,
      limit,
      pct: 0,
      severity: "info",
      currentLabel: formatValue(meta, c),
      limitLabel: limit === null ? "Custom" : formatValue(meta, limit),
    };
  }
  const pct = Math.min(100, Math.round((c / limit) * 100));
  const severity: Severity =
    pct >= 100
      ? "blocked"
      : pct >= 90
        ? "critical"
        : pct >= 80
          ? "warning"
          : pct >= 70
            ? "info"
            : "ok";
  return {
    resource,
    meta,
    current: c,
    limit,
    pct,
    severity,
    currentLabel: formatValue(meta, c),
    limitLabel: formatValue(meta, limit),
  };
}

/** Tailwind class that recolors the shadcn Progress indicator by severity. */
export function severityIndicatorClass(severity: Severity): string {
  switch (severity) {
    case "blocked":
    case "critical":
      return "[&_[data-slot=progress-indicator]]:bg-destructive";
    case "warning":
      return "[&_[data-slot=progress-indicator]]:bg-amber-500";
    case "info":
      return "[&_[data-slot=progress-indicator]]:bg-primary/70";
    default:
      return "";
  }
}
