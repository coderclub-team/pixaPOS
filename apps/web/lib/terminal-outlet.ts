import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@pixa/server";
import { baMember, db, outlets } from "@pixa/db";
import { allowedSurfaces, type SurfaceKey } from "@/lib/surfaces";
import { userOutletIds } from "@/lib/outlet-access";

export type TerminalOutlet = {
  id: string;
  code: string;
  name: string;
  organizationId: string;
};

const normalizeCode = (code: string) => code.trim().toUpperCase();

type OrgRow = { id: string; organizationId: string; role: string };

async function callerOrgs(userId: string): Promise<OrgRow[]> {
  const rows = await db()
    .select({
      id: baMember.id,
      organizationId: baMember.organizationId,
      role: baMember.role,
    })
    .from(baMember)
    .where(eq(baMember.userId, userId));
  return rows;
}

/**
 * Resolve + authorize a staff terminal URL (/pos/CODE …).
 * - Session required, else redirect to sign-in.
 * - Code resolved within the caller's org (active org, else single membership).
 * - Unknown/inactive code → 404 (no org leak).
 * - Role must allow the surface, else redirect to dashboard.
 * - Non-admin roles must hold an outlet assignment, else redirect to dashboard.
 */
export async function requireTerminalOutlet(
  rawCode: string,
  surface: SurfaceKey,
): Promise<TerminalOutlet> {
  const code = normalizeCode(rawCode);
  let session = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    redirect("/auth/sign-in");
  }
  const user = session?.user;
  if (!user) redirect("/auth/sign-in");

  // DB failure means "unknown", never "new user" — send them to the
  // dashboard and let the error-aware client guard decide. Bouncing to
  // /onboarding on transient errors flashes completed users through setup.
  let memberships: OrgRow[];
  try {
    memberships = await callerOrgs(user.id);
  } catch {
    redirect("/dashboard");
  }
  if (memberships.length === 0) redirect("/onboarding");
  const activeOrg =
    (session.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ??
    null;
  const membership =
    memberships.find((m) => m.organizationId === activeOrg) ??
    (memberships.length === 1 ? memberships[0] : null);
  if (!membership) redirect("/dashboard");
  const { organizationId, role } = membership;

  const found = await db()
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
      organizationId: outlets.organizationId,
      isActive: outlets.isActive,
    })
    .from(outlets)
    .where(and(eq(outlets.organizationId, organizationId), eq(outlets.code, code)))
    .limit(1)
    .catch(() => []);
  const outlet = found[0];
  if (!outlet || !outlet.isActive) notFound();

  if (!allowedSurfaces(role).includes(surface)) redirect("/dashboard");

  const allowed = await userOutletIds(organizationId, user.id, role).catch(() => null);
  if (allowed && !allowed.includes(outlet.id)) redirect("/dashboard");

  return {
    id: outlet.id,
    code: outlet.code,
    name: outlet.name,
    organizationId,
  };
}

/** Outlets a user may open on a surface (for bare-route single redirect). */
export async function listTerminalOutlets(
  surface: SurfaceKey,
): Promise<{ outlets: TerminalOutlet[]; single: TerminalOutlet | null }> {
  let session = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    redirect("/auth/sign-in");
  }
  const user = session?.user;
  if (!user) redirect("/auth/sign-in");

  // Same fail-safe as requireTerminalOutlet: DB errors go to the dashboard,
  // only a cleanly-loaded empty membership list means "new user".
  let memberships: OrgRow[];
  try {
    memberships = await callerOrgs(user.id);
  } catch {
    redirect("/dashboard");
  }
  if (memberships.length === 0) redirect("/onboarding");

  const collected: TerminalOutlet[] = [];
  for (const m of memberships) {
    if (!allowedSurfaces(m.role).includes(surface)) continue;
    const rows = await db()
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
        organizationId: outlets.organizationId,
        isActive: outlets.isActive,
      })
      .from(outlets)
      .where(and(eq(outlets.organizationId, m.organizationId), eq(outlets.isActive, true)))
      .orderBy(outlets.name)
      .catch(() => []);
    const allowed = await userOutletIds(m.organizationId, user.id, m.role).catch(() => null);
    for (const r of rows) {
      if (!r.isActive) continue;
      if (allowed && !allowed.includes(r.id)) continue;
      collected.push({ id: r.id, code: r.code, name: r.name, organizationId: r.organizationId });
    }
  }
  return { outlets: collected, single: collected.length === 1 ? collected[0] : null };
}

/**
 * Resolve a public terminal URL (/kiosk/CODE, /qr/CODE). No session —
 * codes are globally unique so the lookup needs no org context.
 * Unknown/inactive code → 404.
 */
export async function resolvePublicOutlet(rawCode: string): Promise<TerminalOutlet> {
  const code = normalizeCode(rawCode);
  const found = await db()
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
      organizationId: outlets.organizationId,
      isActive: outlets.isActive,
    })
    .from(outlets)
    .where(eq(outlets.code, code))
    .limit(1)
    .catch(() => []);
  const outlet = found[0];
  if (!outlet || !outlet.isActive) notFound();
  return {
    id: outlet.id,
    code: outlet.code,
    name: outlet.name,
    organizationId: outlet.organizationId,
  };
}
