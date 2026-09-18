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

export async function baSession() {
  return auth.api.getSession({ headers: await headers() });
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

/** Clerk has({permission}) equivalent for org:resource:action strings. */
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
  const user = await baUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}
