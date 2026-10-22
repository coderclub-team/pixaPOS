import { NextResponse } from "next/server";
import { baMemberRole, baOrgId, baSession } from "@pixa/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — authenticated caller profile + active org context.
 */
export async function GET() {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const organizationId = await baOrgId().catch(() => null);
  const role = organizationId
    ? await baMemberRole(organizationId, session.user.id).catch(() => null)
    : null;

  const activeOrganizationId =
    ((session.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ??
      null) ||
    null;

  return NextResponse.json(
    {
      user: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
      organization_id: organizationId,
      active_organization_id: activeOrganizationId,
      role,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
