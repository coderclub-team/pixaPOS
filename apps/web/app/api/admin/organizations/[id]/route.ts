import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { orgProfiles, saasAudit } from "@pixa/db";
import { ORG_LIFECYCLE } from "@pixa/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (body?.lifecycle !== undefined) {
    if (!(ORG_LIFECYCLE as readonly string[]).includes(String(body.lifecycle))) {
      return NextResponse.json({ ok: false, error: "invalid lifecycle" }, { status: 400 });
    }
    patch.lifecycle = String(body.lifecycle);
  }
  if (body?.plan !== undefined) patch.plan = String(body.plan).slice(0, 40);
  if (body?.isBlocked !== undefined) patch.isBlocked = Boolean(body.isBlocked);
  if (body?.notes !== undefined) patch.notes = String(body.notes).slice(0, 2000) || null;
  if (body?.mrrPaise !== undefined) patch.mrrPaise = Number(body.mrrPaise) || 0;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
  try {
    const db = adminDb();
    const existing = (
      await db.select().from(orgProfiles).where(eq(orgProfiles.organizationId, id))
    )[0];
    if (existing)
      await db
        .update(orgProfiles)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(orgProfiles.organizationId, id));
    else
      await db
        .insert(orgProfiles)
        .values({ organizationId: id, lifecycle: "trial", plan: "starter", ...patch } as never);
    await db.insert(saasAudit).values({
      id: uid("audit"),
      entityType: "organization",
      entityId: id,
      action: "ORG_UPDATED",
      detail: JSON.stringify(patch).slice(0, 1000),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update failed" },
      { status: 500 },
    );
  }
}
