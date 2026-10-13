import { and, eq } from "drizzle-orm";
import { db, outletMembers } from "@pixa/db";

/**
 * Outlets a user may access. Returns null for org admins/managers (all
 * outlets, no rows needed) and for legacy setups where outlet_members is
 * unmigrated/empty (fail-open to today's behavior). Otherwise the active
 * assignment ids. Never throws — callers treat null as unrestricted.
 */
export async function userOutletIds(
  organizationId: string,
  userId: string,
  role: string | null,
): Promise<string[] | null> {
  const r = (role ?? "").toLowerCase();
  if (
    r === "owner" ||
    r === "org:owner" ||
    r === "admin" ||
    r === "org:admin" ||
    r === "manager" ||
    r === "org:manager"
  ) {
    return null;
  }
  try {
    const database = db();
    const rows = await database
      .select({ outletId: outletMembers.outletId })
      .from(outletMembers)
      .where(
        and(
          eq(outletMembers.organizationId, organizationId),
          eq(outletMembers.userId, userId),
          eq(outletMembers.isActive, true),
        ),
      );
    if (rows.length > 0) return rows.map((x) => x.outletId);
    // No personal rows: enforce strictly only once the org has adopted
    // assignments (any active row org-wide); otherwise legacy unrestricted.
    const anyOrg = await database
      .select({ id: outletMembers.id })
      .from(outletMembers)
      .where(
        and(eq(outletMembers.organizationId, organizationId), eq(outletMembers.isActive, true)),
      )
      .limit(1);
    return anyOrg.length > 0 ? [] : null;
  } catch {
    return null;
  }
}
