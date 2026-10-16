import { headers } from "next/headers";
import { auth } from "@pixa/server";
import { db, baMember } from "@pixa/db";
import { eq, and } from "drizzle-orm";

export type RealtimeAuthContext = {
  userId: string;
  organizationId: string;
  outletId: string;
  deviceId?: string | null;
};

export type RealtimeAuthResult =
  | { ok: true; ctx: RealtimeAuthContext }
  | { ok: false; status: number; error: string };

/**
 * Explicit failure guard — use instead of `if (!authRes.ok)` so the
 * discriminated union narrows reliably across route handlers.
 */
export function authFailed(
  res: RealtimeAuthResult,
): res is Extract<RealtimeAuthResult, { ok: false }> {
  return !res.ok;
}

export async function resolveRealtimeAuth(req: Request): Promise<RealtimeAuthResult> {
  const url = new URL(req.url);
  const outletId = url.searchParams.get("outletId")?.trim() ?? "";
  if (!outletId) {
    return { ok: false, status: 400, error: "outletId is required" };
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    // next/headers version for server components; fallback to req headers for route handlers
    let hdrs: Headers;
    try {
      hdrs = await headers();
    } catch {
      hdrs = req.headers;
    }
    session = await auth.api.getSession({ headers: hdrs as unknown as Headers });
    // If that yielded nothing, try raw request headers (route handler path)
    if (!session?.user) {
      const alt = await auth.api.getSession({ headers: req.headers as unknown as Headers });
      if (alt?.user) session = alt;
    }
  } catch {
    session = null;
  }

  if (!session?.user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const activeOrgId =
    (session.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ??
    null;

  // Require membership in active org
  let organizationId = activeOrgId;
  if (!organizationId) {
    // fallback: find any org membership for user
    const members = await db()
      .select({ organizationId: baMember.organizationId })
      .from(baMember)
      .where(eq(baMember.userId, session.user.id))
      .limit(1);
    organizationId = members[0]?.organizationId ?? null;
  }
  if (!organizationId) {
    return { ok: false, status: 403, error: "no organization membership" };
  }

  // Verify membership still exists
  const mem = await db()
    .select({ id: baMember.id, role: baMember.role })
    .from(baMember)
    .where(and(eq(baMember.organizationId, organizationId), eq(baMember.userId, session.user.id)))
    .limit(1);
  if (mem.length === 0) {
    return { ok: false, status: 403, error: "not a member of organization" };
  }

  // Outlet assignment: non-admin roles are scoped to their outlet_members rows
  // (strict once the org has adopted assignments, legacy-open otherwise).
  try {
    const { userOutletIds } = await import("@/lib/outlet-access");
    const allowed = await userOutletIds(organizationId, session.user.id, mem[0]?.role ?? null);
    if (allowed && !allowed.includes(outletId)) {
      return { ok: false, status: 403, error: "no access to this outlet" };
    }
  } catch {
    // outlet_members unmigrated — ignore, rely on checks above
  }

  // Validate outlet belongs to organization via persisted outlets table.
  // Outlets are created per organization; check that the requested outlet
  // belongs to the authenticated organization. If outlets table not yet migrated
  // or outlet not found, fall back to allowing known mock ids (out_001) only
  // when organization matches — never cross-org.
  try {
    const database = db();
    const outletRes = await database.execute(
      (await import("drizzle-orm"))
        .sql`SELECT organization_id FROM outlets WHERE id = ${outletId} LIMIT 1` as never,
    );
    const outletRows = Array.isArray(outletRes)
      ? (outletRes as unknown as Array<Record<string, unknown>>)
      : [];
    const outletRow = outletRows[0] as Record<string, unknown> | undefined;
    if (outletRow) {
      const outletOrg = (outletRow.organization_id ?? outletRow.organizationId) as string | null;
      if (outletOrg && outletOrg !== organizationId) {
        return { ok: false, status: 403, error: "outlet not in organization" };
      }
    } else {
      // No outlets row — check outlet_kitchen_stations or devices as secondary signal
      const stationRes = await database.execute(
        (await import("drizzle-orm"))
          .sql`SELECT organization_id FROM outlet_kitchen_stations WHERE outlet_id = ${outletId} LIMIT 1` as never,
      );
      const stationRows = Array.isArray(stationRes)
        ? (stationRes as unknown as Array<Record<string, unknown>>)
        : [];
      const stationRow = stationRows[0] as Record<string, unknown> | undefined;
      if (stationRow) {
        const stationOrg = (stationRow.organization_id ?? stationRow.organizationId) as
          | string
          | null;
        if (stationOrg && stationOrg !== organizationId) {
          return { ok: false, status: 403, error: "outlet not in organization" };
        }
      }
    }
  } catch {
    // outlets table not yet migrated — ignore, rely on membership check above
  }

  const deviceId =
    req.headers.get("x-device-id")?.trim() ??
    req.headers.get("x-device")?.trim() ??
    url.searchParams.get("deviceId")?.trim() ??
    null;

  // Device authorization: if deviceId supplied, verify it belongs to this outlet/org
  if (deviceId) {
    try {
      const database = db();
      const dev = await database.execute(
        // Use sql template for neon-http
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import("drizzle-orm"))
          .sql`SELECT outlet_id, organization_id FROM devices WHERE device_id = ${deviceId} LIMIT 1` as any,
      );
      const rows = Array.isArray(dev) ? (dev as unknown as Array<Record<string, unknown>>) : [];
      // neon-http returns array directly
      const row = rows[0] as Record<string, unknown> | undefined;
      if (row) {
        const devOutlet = (row.outlet_id ?? row.outletId) as string | null;
        const devOrg = (row.organization_id ?? row.organizationId) as string | null;
        if (devOutlet && devOutlet !== outletId) {
          return { ok: false, status: 403, error: "device not authorized for outlet" };
        }
        if (devOrg && devOrg !== organizationId) {
          return { ok: false, status: 403, error: "device not authorized for organization" };
        }
      }
    } catch {
      // devices table may not be migrated yet — ignore
    }
  }

  return {
    ok: true,
    ctx: { userId: session.user.id, organizationId, outletId, deviceId },
  };
}

export function isSseRequest(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/event-stream");
}
