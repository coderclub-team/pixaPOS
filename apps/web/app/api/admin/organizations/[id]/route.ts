import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { orgProfiles } from "@pixa/db";
import { ORG_LIFECYCLE } from "@pixa/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi(["orgs:lifecycle"]);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (body?.lifecycle !== undefined) {
    if (!(ORG_LIFECYCLE as readonly string[]).includes(String(body.lifecycle))) {
      return NextResponse.json({ ok: false, error: "invalid lifecycle" }, { status: 400 });
    }
    patch.lifecycle = String(body.lifecycle);
  }
  if (body?.plan !== undefined) {
    const planId = String(body.plan).slice(0, 40);
    try {
      const { saasPlans } = await import("@pixa/db");
      const found = await adminDb()
        .select({ id: saasPlans.id })
        .from(saasPlans)
        .where(eq(saasPlans.id, planId))
        .limit(1);
      if (found.length === 0) {
        return NextResponse.json({ ok: false, error: "unknown plan" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
    }
    patch.plan = planId;
  }
  if (body?.isBlocked !== undefined) patch.isBlocked = Boolean(body.isBlocked);
  if (body?.notes !== undefined) patch.notes = String(body.notes).slice(0, 2000) || null;
  if (body?.mrrPaise !== undefined) patch.mrrPaise = Number(body.mrrPaise) || 0;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
  // Step-up: suspending/blocking an org requires the acting owner's password
  // in the same request (step-up re-auth for destructive acts, no TOTP v1).
  if (patch.isBlocked === true || patch.lifecycle === "suspended") {
    const confirm = String(body?.confirmPassword ?? "");
    if (!confirm) {
      return NextResponse.json(
        { ok: false, error: "password confirmation required" },
        { status: 403 },
      );
    }
    try {
      const { saasOwners } = await import("@pixa/db");
      const { verifyPassword } = await import("@/lib/saas-owner");
      const rows = await adminDb()
        .select()
        .from(saasOwners)
        .where(eq(saasOwners.id, auth.owner.id))
        .limit(1);
      if (rows.length === 0 || !verifyPassword(confirm, rows[0].passwordHash)) {
        return NextResponse.json(
          { ok: false, error: "password confirmation failed" },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
    }
  }
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
    await auditOwnerAction(
      auth.owner,
      "organization",
      id,
      "ORG_UPDATED",
      JSON.stringify(patch).slice(0, 1000),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update failed" },
      { status: 500 },
    );
  }
}
