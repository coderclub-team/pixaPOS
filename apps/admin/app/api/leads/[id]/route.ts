import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/db";
import { saasAudit, saasLeads } from "@pixa/db";
import { LEAD_STATUS } from "@pixa/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = String(body?.status ?? "");
  if (!(LEAD_STATUS as readonly string[]).includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
  }
  try {
    const db = adminDb();
    await db.update(saasLeads).set({ status, updatedAt: new Date() }).where(eq(saasLeads.id, id));
    await db
      .insert(saasAudit)
      .values({
        id: uid("audit"),
        entityType: "lead",
        entityId: id,
        action: `LEAD_${status.toUpperCase()}`,
        detail: null,
      });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
