import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { crmTickets, TICKET_PRIORITY, TICKET_STATUS } from "@pixa/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerApi(["tickets:read"]);
  if ("response" in auth) return auth.response;
  try {
    const rows = await adminDb()
      .select()
      .from(crmTickets)
      .orderBy(desc(crmTickets.createdAt))
      .limit(200);
    return NextResponse.json({ ok: true, tickets: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi(["tickets:write"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const subject = String(body?.subject ?? "").trim();
  const description = String(body?.description ?? "").trim();
  if (!subject || !description) {
    return NextResponse.json(
      { ok: false, error: "subject and description required" },
      { status: 400 },
    );
  }
  const priority = String(body?.priority ?? "normal");
  if (!(TICKET_PRIORITY as readonly string[]).includes(priority)) {
    return NextResponse.json({ ok: false, error: "invalid priority" }, { status: 400 });
  }
  try {
    const id = uid("tkt");
    await adminDb()
      .insert(crmTickets)
      .values({
        id,
        organizationId: String(body?.organizationId ?? "").trim() || null,
        subject: subject.slice(0, 200),
        description: description.slice(0, 4000),
        channel: String(body?.channel ?? "app").slice(0, 40),
        priority,
        reporterEmail: String(body?.reporterEmail ?? "").trim() || null,
      });
    await auditOwnerAction(auth.owner, "ticket", id, "TICKET_OPENED", subject.slice(0, 200));
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireOwnerApi(["tickets:write"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.status !== undefined) {
    if (!(TICKET_STATUS as readonly string[]).includes(String(body.status))) {
      return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
    }
    patch.status = String(body.status);
    if (body.status === "resolved" || body.status === "closed") patch.resolvedAt = new Date();
  }
  if (body?.priority !== undefined) {
    if (!(TICKET_PRIORITY as readonly string[]).includes(String(body.priority))) {
      return NextResponse.json({ ok: false, error: "invalid priority" }, { status: 400 });
    }
    patch.priority = String(body.priority);
  }
  if (body?.assignedTo !== undefined)
    patch.assignedTo = String(body.assignedTo).slice(0, 120) || null;
  try {
    await adminDb().update(crmTickets).set(patch).where(eq(crmTickets.id, id));
    await auditOwnerAction(
      auth.owner,
      "ticket",
      id,
      "TICKET_UPDATED",
      JSON.stringify(patch).slice(0, 300),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
