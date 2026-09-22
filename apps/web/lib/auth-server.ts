/**
 * Server identity helpers (Better Auth only).
 */
import { baHas, baMemberRole, baOrgId, baUser } from "./auth-session";
import { hasDevBypass } from "./authz";

export type OrgContext = {
  source: "better" | null;
  orgId: string | null;
  role: string | null;
  permissions: string[];
};

/** Resolve org context from the Better Auth session. */
export async function orgContext(): Promise<OrgContext> {
  const bau = await baUser().catch(() => null);
  if (!bau) return { source: null, orgId: null, role: null, permissions: [] };
  const orgId = await baOrgId();
  const role = orgId ? await baMemberRole(orgId, bau.id) : null;
  const { ROLE_PERMISSIONS } = await import("@/config/permissions");
  const permissions =
    role === "owner" || role === "org:owner"
      ? Object.values(ROLE_PERMISSIONS).flat()
      : (ROLE_PERMISSIONS[`org:${role}`] ?? (role ? (ROLE_PERMISSIONS[role] ?? []) : []));
  return { source: "better", orgId, role, permissions };
}

/** Permission gate against the Better Auth role map. */
export async function anyHas(permission: string): Promise<boolean> {
  if (hasDevBypass()) return true;
  return baHas(permission);
}

/** Super-admin gate for role/permission management (either identity). */
export async function assertAnySuperAdmin(): Promise<string> {
  const ctx = await orgContext();
  if (!ctx.orgId) throw new Error("No active organization selected.");
  const adminish =
    ctx.role === "org:admin" ||
    ctx.role === "admin" ||
    ctx.role === "owner" ||
    ctx.role === "org:owner";
  if (!hasDevBypass() && !adminish) {
    throw new Error("Only super admins can manage roles and permissions.");
  }
  return ctx.orgId;
}
