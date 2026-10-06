/**
 * Organization usage service.
 *
 * Product counts (users/outlets/devices/orders/products/customers) are
 * recomputed from operational tables where they are organization-scoped;
 * infrastructure metrics (storage/compute/functions/transfer/written data)
 * are synchronized periodically from Neon consumption data into `org_usage`.
 *
 * POS/KDS requests NEVER call Neon usage APIs — they read the local snapshot
 * and increment counters. Only the scheduled sync and explicit recompute
 * touch the stored row.
 */
import { and, count, eq, gte } from "drizzle-orm";
import { RESOURCE_LIMITS, baMember, orgUsage, type LimitMap } from "@pixa/db";
import { adminDb } from "@/lib/saas-admin";

export type UsageMap = Record<(typeof RESOURCE_LIMITS)[number], number>;

export type UsageSnapshot = {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  usage: UsageMap;
  limits: LimitMap | null;
  infraSyncedAt: string | null;
  updatedAt: string | null;
};

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

function rowToUsage(row: typeof orgUsage.$inferSelect): UsageMap {
  return {
    outlets: row.outletsCount,
    users: row.usersCount,
    devices: row.devicesCount,
    orders: row.ordersCount,
    products: row.productsCount,
    customers: row.customersCount,
    databaseStorage: row.databaseStorageBytes,
    objectStorage: row.objectStorageBytes,
    compute: row.computeCuHours,
    functions: row.functionInvocations,
    transfer: row.dataTransferBytes,
    writtenData: row.writtenDataBytes,
  };
}

async function ensureRow(organizationId: string) {
  const db = adminDb();
  const { start, end } = monthBounds();
  const existing = (
    await db.select().from(orgUsage).where(eq(orgUsage.organizationId, organizationId))
  )[0];
  if (existing) {
    // Roll the monthly counters when the billing period has changed.
    if (existing.periodStart.getTime() !== start.getTime()) {
      const rolled = await db
        .update(orgUsage)
        .set({
          periodStart: start,
          periodEnd: end,
          ordersCount: 0,
          computeCuHours: 0,
          functionInvocations: 0,
          dataTransferBytes: 0,
          writtenDataBytes: 0,
          updatedAt: new Date(),
        })
        .where(eq(orgUsage.organizationId, organizationId))
        .returning();
      return rolled[0];
    }
    return existing;
  }
  const inserted = await db
    .insert(orgUsage)
    .values({ organizationId, periodStart: start, periodEnd: end })
    .onConflictDoNothing({ target: orgUsage.organizationId })
    .returning();
  if (inserted[0]) return inserted[0];
  return (await db.select().from(orgUsage).where(eq(orgUsage.organizationId, organizationId)))[0]!;
}

/** Live organization-scoped product counts we can trust from the DB. */
async function liveUsers(organizationId: string): Promise<number> {
  try {
    const rows = await adminDb()
      .select({ n: count() })
      .from(baMember)
      .where(eq(baMember.organizationId, organizationId));
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

/** Count orders created this period for an outlet (used by the sync route). */
export async function countOrdersSince(outletId: string, since: Date): Promise<number> {
  try {
    const { orders } = await import("@pixa/db");
    const rows = await adminDb()
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.outletId, outletId), gte(orders.createdAt, since)));
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

/** Read the usage snapshot (creates/rolls the row as needed, refreshes users). */
export async function getUsage(organizationId: string): Promise<UsageMap> {
  const row = await ensureRow(organizationId);
  const usage = rowToUsage(row);
  usage.users = await liveUsers(organizationId);
  return usage;
}

export async function getUsageSnapshot(
  organizationId: string,
  limits: LimitMap | null = null,
): Promise<UsageSnapshot> {
  const row = await ensureRow(organizationId);
  const usage = rowToUsage(row);
  usage.users = await liveUsers(organizationId);
  return {
    organizationId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    usage,
    limits,
    infraSyncedAt: row.infraSyncedAt ? row.infraSyncedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Persist product counts (from the sync route / admin recompute). */
export async function writeProductUsage(
  organizationId: string,
  counts: Partial<Pick<UsageMap, "outlets" | "devices" | "orders" | "products" | "customers">>,
): Promise<void> {
  await ensureRow(organizationId);
  await adminDb()
    .update(orgUsage)
    .set({
      ...(counts.outlets !== undefined ? { outletsCount: counts.outlets } : {}),
      ...(counts.devices !== undefined ? { devicesCount: counts.devices } : {}),
      ...(counts.orders !== undefined ? { ordersCount: counts.orders } : {}),
      ...(counts.products !== undefined ? { productsCount: counts.products } : {}),
      ...(counts.customers !== undefined ? { customersCount: counts.customers } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orgUsage.organizationId, organizationId));
}

/** Persist infrastructure metrics from Neon consumption data. */
export async function writeInfraUsage(
  organizationId: string,
  metrics: Partial<
    Omit<UsageMap, "outlets" | "users" | "devices" | "orders" | "products" | "customers">
  >,
): Promise<void> {
  await ensureRow(organizationId);
  await adminDb()
    .update(orgUsage)
    .set({
      ...(metrics.databaseStorage !== undefined
        ? { databaseStorageBytes: metrics.databaseStorage }
        : {}),
      ...(metrics.objectStorage !== undefined ? { objectStorageBytes: metrics.objectStorage } : {}),
      ...(metrics.compute !== undefined ? { computeCuHours: metrics.compute } : {}),
      ...(metrics.functions !== undefined ? { functionInvocations: metrics.functions } : {}),
      ...(metrics.transfer !== undefined ? { dataTransferBytes: metrics.transfer } : {}),
      ...(metrics.writtenData !== undefined ? { writtenDataBytes: metrics.writtenData } : {}),
      infraSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orgUsage.organizationId, organizationId));
}

/** Usage vs limit for one resource, with a 0–100 ratio and severity band. */
export type UsageBar = {
  resource: (typeof RESOURCE_LIMITS)[number];
  current: number;
  limit: number | null;
  pct: number;
  severity: "ok" | "info" | "warning" | "critical" | "blocked";
};

export function toBar(
  resource: (typeof RESOURCE_LIMITS)[number],
  current: number,
  limit: number | null,
): UsageBar {
  if (limit === null || limit <= 0) {
    return { resource, current, limit, pct: 0, severity: "info" };
  }
  const pct = Math.min(100, Math.round((current / limit) * 100));
  const severity =
    pct >= 100
      ? "blocked"
      : pct >= 90
        ? "critical"
        : pct >= 80
          ? "warning"
          : pct >= 70
            ? "info"
            : "ok";
  return { resource, current, limit, pct, severity };
}
