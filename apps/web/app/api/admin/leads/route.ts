import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, leadIntakeAllowed, requireOwnerApi } from "@/lib/saas-owner";
import { saasAudit, saasLeads } from "@pixa/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const auth = await requireOwnerApi(["leads:read"]);
  if ("response" in auth) return auth.response;
  try {
    const rows = await adminDb()
      .select()
      .from(saasLeads)
      .orderBy(desc(saasLeads.createdAt))
      .limit(200);
    return NextResponse.json({ ok: true, leads: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}

/** Public website registration → lead row. Owner auth NOT required here
 * (it's the public intake), but per-IP rate limiting applies. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!leadIntakeAllowed(ip)) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const businessName = String(body?.businessName ?? body?.business_name ?? "").trim();
  const contactName = String(body?.contactName ?? body?.contact_name ?? "").trim();
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const phone = String(body?.phone ?? "").trim();
  if (!businessName || !contactName || !EMAIL.test(email) || phone.length < 7) {
    return NextResponse.json(
      { ok: false, error: "businessName, contactName, valid email and phone are required" },
      { status: 400 },
    );
  }
  try {
    const db = adminDb();
    const id = uid("lead");
    await db.insert(saasLeads).values({
      id,
      businessName,
      contactName,
      email,
      phone,
      city: String(body?.city ?? "").trim() || null,
      outletsPlanned: Number(body?.outletsPlanned ?? 1) || 1,
      source: String(body?.source ?? "website").slice(0, 40),
      notes: String(body?.notes ?? "").slice(0, 2000) || null,
      status: "new",
    });
    await db.insert(saasAudit).values({
      id: uid("audit"),
      entityType: "lead",
      entityId: id,
      action: "LEAD_CREATED",
      detail: `${businessName} <${email}>`,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
