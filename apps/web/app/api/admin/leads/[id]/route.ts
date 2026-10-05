import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { saasLeads } from "@pixa/db";
import { LEAD_STATUS } from "@pixa/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi(["leads:write"]);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = String(body?.status ?? "");
  if (!(LEAD_STATUS as readonly string[]).includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
  }
  try {
    const db = adminDb();
    await db.update(saasLeads).set({ status, updatedAt: new Date() }).where(eq(saasLeads.id, id));
    await auditOwnerAction(auth.owner, "lead", id, `LEAD_${status.toUpperCase()}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
