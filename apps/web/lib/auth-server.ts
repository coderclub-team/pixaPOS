/**
 * Dual-auth server helpers (Phase 1 strangler). Every gate accepts a Clerk
 * session OR a Better Auth session; cutover deletes the Clerk leg.
 */
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { baHas, baMemberRole, baOrgId, baUser } from "./auth-session";
import { hasDevBypass } from "./authz";

export type OrgContext = {
  source: "better" | "clerk" | null;
  orgId: string | null;
  role: string | null;
  permissions: string[];
};

/** Resolve org context from whichever identity is present. */
export async function orgContext(): Promise<OrgContext> {
  const bau = await baUser().catch(() => null);
  if (bau) {
    const orgId = await baOrgId();
    const role = orgId ? await baMemberRole(orgId, bau.id) : null;
    const { ROLE_PERMISSIONS } = await import("@/config/permissions");
    const permissions =
      ROLE_PERMISSIONS[`org:${role}`] ?? (role ? (ROLE_PERMISSIONS[role] ?? []) : []);
    return { source: "better", orgId, role, permissions };
  }
  const { orgId, orgRole, has } = await clerkAuth();
  void has;
  // Clerk membership permissions for nav parity are client-side; server gates
  // use role + explicit permission probe below.
  return { source: orgId ? "clerk" : null, orgId, role: orgRole ?? null, permissions: [] };
}

/** Clerk has({permission}) OR Better Auth role-map check. */
export async function anyHas(permission: string): Promise<boolean> {
  if (hasDevBypass()) return true;
  try {
    const { has } = await clerkAuth();
    if (has({ permission: permission as never })) return true;
  } catch {
    /* no Clerk session — try Better Auth */
  }
  return baHas(permission);
}

/** Super-admin gate for role/permission management (either identity). */
export async function assertAnySuperAdmin(): Promise<string> {
  const ctx = await orgContext();
  if (!ctx.orgId) throw new Error("No active organization selected.");
  const adminish = ctx.role === "org:admin" || ctx.role === "admin";
  if (!hasDevBypass() && !adminish) {
    throw new Error("Only super admins can manage roles and permissions.");
  }
  return ctx.orgId;
}
