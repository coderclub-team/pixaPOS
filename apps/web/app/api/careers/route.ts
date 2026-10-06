import { NextResponse } from "next/server";
import { adminDb, uid } from "@/lib/saas-admin";
import { saasAudit, saasLeads } from "@pixa/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const fullName = String(body?.fullName ?? body?.full_name ?? "").trim();
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    const phone = String(body?.phone ?? "").trim();
    const role = String(body?.role ?? "").trim() || "General application";
    const experience = String(body?.experience ?? "").trim();
    const city = String(body?.city ?? "").trim();
    const resumeName = String(body?.resumeName ?? "").trim();
    const coverLetter = String(body?.coverLetter ?? "").trim();

    if (!fullName || !EMAIL.test(email) || phone.length < 7) {
      return NextResponse.json(
        { ok: false, error: "Full name, valid email and phone are required." },
        { status: 400 },
      );
    }

    const db = adminDb();
    const id = uid("career");
    const notes = { role, experience, city, resumeName, coverLetter: coverLetter.slice(0, 500) };

    await db.insert(saasLeads).values({
      id,
      businessName: role,
      contactName: fullName,
      email,
      phone,
      city: city || null,
      outletsPlanned: 1,
      source: "career",
      notes: JSON.stringify(notes),
      status: "new",
    });

    await db.insert(saasAudit).values({
      id: uid("audit"),
      entityType: "career",
      entityId: id,
      action: "CAREER_APPLICATION_CREATED",
      detail: `${fullName} <${email}> applied for ${role}`,
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });
  }
}
