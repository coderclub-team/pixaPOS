import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, outlets } from "@pixa/db";
import { baHas, baOrgId, baSession } from "@pixa/server";

export type ApiAuth = {
  organizationId: string;
  userId: string;
};

export type ApiActor = {
  organizationId: string;
  outletId?: string | null;
  actorId: string;
};

/**
 * Shared API auth: session + active org (+ optional permission).
 * Mirrors the masters route authz — single choke point for server routes.
 */
export async function authz(
  permission?: string,
): Promise<{ auth: ApiAuth } | { error: NextResponse }> {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!session?.user)
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const organizationId = await baOrgId().catch(() => null);
  if (!organizationId)
    return {
      error: NextResponse.json(
        {
          error: "no active organization",
          hint: "Complete onboarding at /onboarding or POST /api/auth/organization/set-active with your organizationId, then retry.",
        },
        { status: 400 },
      ),
    };
  if (permission && !(await baHas(permission).catch(() => false))) {
    return {
      error: NextResponse.json({ error: `forbidden: ${permission} required` }, { status: 403 }),
    };
  }
  return { auth: { organizationId, userId: session.user.id } };
}

export function denied(error: NextResponse): error is NextResponse {
  return error instanceof NextResponse;
}

/**
 * Verify an outlet belongs to the caller's org. Returns the outlet id.
 * Pass outletId undefined to skip (org-wide reads).
 */
export async function assertOrgOutlet(
  organizationId: string,
  outletId: string | undefined | null,
  { required = false }: { required?: boolean } = {},
): Promise<string | null> {
  if (!outletId) {
    if (required) throw new Error("outlet_id is required");
    return null;
  }
  const rows = await db()
    .select({ id: outlets.id })
    .from(outlets)
    .where(and(eq(outlets.id, outletId), eq(outlets.organizationId, organizationId)))
    .limit(1);
  if (!rows.length) throw new Error("unknown outlet");
  return outletId;
}

export function toHttpError(e: unknown, fallback = "request failed"): NextResponse {
  const msg = e instanceof Error ? e.message : String(e);
  if (/unauthorized/i.test(msg)) return NextResponse.json({ error: msg }, { status: 401 });
  if (/unknown outlet|not found/i.test(msg))
    return NextResponse.json({ error: msg }, { status: 404 });
  // State-machine conflicts come before the generic validation bucket.
  if (/Illegal .* transition|Cannot .* while|can only/i.test(msg)) {
    return NextResponse.json({ error: msg }, { status: 409 });
  }
  if (/DATABASE_URL/.test(msg))
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  if (
    /required|invalid|duplicate|already|full|seated|sharing|capacity|blocked|cleaning|out of service|window|overlap|moved|transfer|split|settle|locked|conflict|mismatch|expired|collect|remaining|balance|exceeds|dispatch|rider|deliver|address|serve|void|return|refund|fire|discount|promo|reward|payment|tender|qty|quantity|amount|cancel|complet|delete|attach|detach|customer|note|hold|block|status|prepar|ready|accept|expire|empty|cover|shrink|rename|drop|share|guest|label|reason|party|order|item|line|kot|bill|paid|over|under|between|at least|at most|must|needs|allows|belongs|available|open|closed|served|fired/i.test(
      msg,
    )
  ) {
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  // eslint-disable-next-line no-console
  console.error("[api]", msg.slice(0, 300));
  return NextResponse.json({ error: fallback }, { status: 500 });
}
