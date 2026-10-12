import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, publicHolidays } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";

export const dynamic = "force-dynamic";

/** GET /api/payroll/holidays?year= — org calendar. */
export async function GET(req: Request) {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  const year = new URL(req.url).searchParams.get("year") ?? "";
  try {
    const rows = await db()
      .select()
      .from(publicHolidays)
      .where(eq(publicHolidays.organizationId, a.organizationId));
    const list = (year ? rows.filter((r) => String(r.date).startsWith(year)) : rows).sort((x, y) =>
      String(x.date).localeCompare(String(y.date)),
    );
    return NextResponse.json({ holidays: list }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to list holidays" }, { status: 500 });
  }
}

/** POST /api/payroll/holidays — { name, date: YYYY-MM-DD, is_optional? }. */
export async function POST(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const date = String(body.date ?? "").trim();
  if (name.length < 2)
    return NextResponse.json({ error: "name required (min 2)" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  try {
    const [row] = await db()
      .insert(publicHolidays)
      .values({
        id: ulid(),
        organizationId: a.organizationId,
        outletId: null,
        name,
        date,
        isOptional: body.is_optional === true,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      })
      .returning();
    return NextResponse.json({ holiday: row }, { status: 201, headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json({ error: "holiday already exists on this date" }, { status: 409 });
    }
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to create holiday" }, { status: 500 });
  }
}

/** DELETE /api/payroll/holidays?id= — remove a date. */
export async function DELETE(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const rows = await db()
      .delete(publicHolidays)
      .where(and(eq(publicHolidays.id, id), eq(publicHolidays.organizationId, a.organizationId)))
      .returning({ id: publicHolidays.id });
    if (rows.length === 0)
      return NextResponse.json({ error: "holiday not found" }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to delete holiday" }, { status: 500 });
  }
}
