import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { crmEnquiries, ENQUIRY_STATUS } from "@pixa/db";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const auth = await requireOwnerApi(["crm:read"]);
  if ("response" in auth) return auth.response;
  try {
    const rows = await adminDb()
      .select()
      .from(crmEnquiries)
      .orderBy(desc(crmEnquiries.createdAt))
      .limit(200);
    return NextResponse.json({ ok: true, enquiries: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOwnerApi(["crm:write"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const businessName = String(body?.businessName ?? "").trim();
  const contactName = String(body?.contactName ?? "").trim();
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const phone = String(body?.phone ?? "").trim();
  if (!businessName || !contactName || !EMAIL.test(email) || phone.length < 7) {
    return NextResponse.json(
      { ok: false, error: "businessName, contactName, valid email and phone required" },
      { status: 400 },
    );
  }
  try {
    const id = uid("enq");
    await adminDb()
      .insert(crmEnquiries)
      .values({
        id,
        businessName,
        contactName,
        email,
        phone,
        city: String(body?.city ?? "").trim() || null,
        outletsPlanned: Math.max(1, Number(body?.outletsPlanned ?? 1) || 1),
        source: String(body?.source ?? "website").slice(0, 40),
        status: "new",
        notes: String(body?.notes ?? "").slice(0, 2000) || null,
      });
    await auditOwnerAction(auth.owner, "enquiry", id, "ENQUIRY_CREATED", businessName);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireOwnerApi(["crm:write"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.status !== undefined) {
    if (!(ENQUIRY_STATUS as readonly string[]).includes(String(body.status))) {
      return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
    }
    patch.status = String(body.status);
  }
  if (body?.assignedTo !== undefined)
    patch.assignedTo = String(body.assignedTo).slice(0, 120) || null;
  if (body?.notes !== undefined) patch.notes = String(body.notes).slice(0, 2000) || null;
  if (body?.leadId !== undefined) patch.leadId = String(body.leadId).slice(0, 64) || null;
  try {
    await adminDb().update(crmEnquiries).set(patch).where(eq(crmEnquiries.id, id));
    await auditOwnerAction(
      auth.owner,
      "enquiry",
      id,
      "ENQUIRY_UPDATED",
      JSON.stringify(patch).slice(0, 300),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
