/**
 * Better Auth server session helpers (Phase 1 strangler).
 * Permission checks resolve the member's org role from Postgres and test it
 * against ROLE_PERMISSIONS — deterministic across better-auth versions.
 */
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db, baMember } from "@pixa/db";
import { ROLE_PERMISSIONS } from "@/config/permissions";

/**
 * Resilient session lookup: Better Auth hits Neon on every call, and a cold
 * compute / slow network surfaces as `fetch failed`. Retry once, then return
 * null so callers degrade to sign-in redirect instead of crashing the layout.
 * Never throws on transport errors.
 */
export async function baSession() {
  const hdrs = await headers();
  try {
    return await auth.api.getSession({ headers: hdrs });
  } catch (e) {
    const msg = e instanceof Error ? ((e.cause as Error | undefined)?.message ?? e.message) : "";
    if (!/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|NeonDbError/i.test(String(msg))) throw e;
    await new Promise((r) => setTimeout(r, 800));
    try {
      return await auth.api.getSession({ headers: hdrs });
    } catch {
      return null;
    }
  }
}

export async function baUser() {
  const session = await baSession();
  return session?.user ?? null;
}

/** Active org id from the session (set via organization.setActive). */
export async function baOrgId(): Promise<string | null> {
  const session = await baSession();
  return (
    (session?.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ??
    null
  );
}

export async function baMemberRole(orgId: string, userId: string): Promise<string | null> {
  const rows = await db()
    .select({ role: baMember.role })
    .from(baMember)
    .where(and(eq(baMember.organizationId, orgId), eq(baMember.userId, userId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

/** Permission check for org:resource:action strings. */
export async function baHas(permission: string): Promise<boolean> {
  const session = await baSession();
  if (!session?.user) return false;
  const orgId = await baOrgId();
  if (!orgId) return false;
  const role = await baMemberRole(orgId, session.user.id);
  if (!role) return false;
  // Org creators hold "owner" — full access like org:admin.
  if (role === "owner" || role === "org:owner") return true;
  return (ROLE_PERMISSIONS[`org:${role}`] ?? ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export async function requireBaUser() {
  try {
    const user = await baUser();
    if (user) return user;
  } catch {
    // Session store unreachable (offline): honor a paired device session.
    // Online-but-anonymous still falls through to sign-in below.
    const { readDeviceCookie, verifyDeviceToken } = await import("./device-token");
    const raw = readDeviceCookie((await headers()).get("cookie"));
    if (raw) {
      const claims = await verifyDeviceToken(raw);
      if (claims) {
        return {
          id: claims.user_id ?? `device:${claims.device_id}`,
          email: undefined,
          name: claims.kiosk ? "Kiosk" : undefined,
        } as unknown as NonNullable<Awaited<ReturnType<typeof baUser>>>;
      }
    }
  }
  redirect("/auth/sign-in");
}
