import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { crmFollowups } from "@pixa/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireOwnerApi(["crm:read"]);
  if ("response" in auth) return auth.response;
  const enquiryId = new URL(req.url).searchParams.get("enquiryId") ?? "";
  if (!enquiryId)
    return NextResponse.json({ ok: false, error: "enquiryId required" }, { status: 400 });
  try {
    const rows = await adminDb()
      .select()
      .from(crmFollowups)
      .where(eq(crmFollowups.enquiryId, enquiryId))
      .orderBy(desc(crmFollowups.createdAt))
      .limit(100);
    return NextResponse.json({ ok: true, followups: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi(["crm:write"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const enquiryId = String(body?.enquiryId ?? "");
  const note = String(body?.note ?? "").trim();
  if (!enquiryId || !note) {
    return NextResponse.json({ ok: false, error: "enquiryId and note required" }, { status: 400 });
  }
  const nextAt = body?.nextFollowUpAt ? new Date(String(body.nextFollowUpAt)) : null;
  if (body?.nextFollowUpAt && Number.isNaN(nextAt!.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid nextFollowUpAt" }, { status: 400 });
  }
  try {
    const id = uid("fol");
    await adminDb()
      .insert(crmFollowups)
      .values({
        id,
        enquiryId,
        note: note.slice(0, 2000),
        nextFollowUpAt: nextAt,
        authorEmail: auth.owner.email,
      });
    await auditOwnerAction(auth.owner, "enquiry", enquiryId, "FOLLOWUP_LOGGED", note.slice(0, 200));
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
