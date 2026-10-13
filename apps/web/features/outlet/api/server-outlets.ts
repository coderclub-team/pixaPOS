import { eq } from "drizzle-orm";
import { db, outlets } from "@pixa/db";
import { baOrgId } from "@/lib/auth-session";

/**
 * Server-side check: does the caller's active organization have at least one
 * outlet row? Used to gate "new entity" pages (floors, tables) — with zero
 * outlets there is nothing to attach to, so callers redirect to the outlet
 * setup instead of rendering a form that can never save.
 */
export async function orgHasOutlets(): Promise<boolean> {
  try {
    const orgId = await baOrgId().catch(() => null);
    if (!orgId) return false;
    const rows = await db()
      .select({ id: outlets.id })
      .from(outlets)
      .where(eq(outlets.organizationId, orgId))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}
