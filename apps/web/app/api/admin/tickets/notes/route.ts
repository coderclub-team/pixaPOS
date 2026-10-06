import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { crmTicketNotes } from "@pixa/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireOwnerApi(["tickets:read"]);
  if ("response" in auth) return auth.response;
  const ticketId = new URL(req.url).searchParams.get("ticketId") ?? "";
  if (!ticketId)
    return NextResponse.json({ ok: false, error: "ticketId required" }, { status: 400 });
  try {
    const rows = await adminDb()
      .select()
      .from(crmTicketNotes)
      .where(eq(crmTicketNotes.ticketId, ticketId))
      .orderBy(desc(crmTicketNotes.createdAt))
      .limit(100);
    return NextResponse.json({ ok: true, notes: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi(["tickets:write"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const ticketId = String(body?.ticketId ?? "");
  const note = String(body?.note ?? "").trim();
  if (!ticketId || !note) {
    return NextResponse.json({ ok: false, error: "ticketId and note required" }, { status: 400 });
  }
  try {
    const id = uid("tkn");
    await adminDb()
      .insert(crmTicketNotes)
      .values({
        id,
        ticketId,
        note: note.slice(0, 4000),
        authorEmail: auth.owner.email,
      });
    await auditOwnerAction(auth.owner, "ticket", ticketId, "TICKET_NOTE", note.slice(0, 200));
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
