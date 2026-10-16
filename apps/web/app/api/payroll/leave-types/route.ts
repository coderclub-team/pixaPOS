import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, leaveTypes } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";

export const dynamic = "force-dynamic";

/** GET /api/payroll/leave-types — active catalog. Any member may read. */
export async function GET() {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  try {
    const rows = await db()
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.organizationId, a.organizationId));
    return NextResponse.json({ leave_types: rows }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to list leave types" }, { status: 500 });
  }
}

/** POST /api/payroll/leave-types — quota in days (decimals allowed). */
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
  if (name.length < 2)
    return NextResponse.json({ error: "name required (min 2)" }, { status: 400 });
  const quota = Number(body.yearly_quota);
  if (!Number.isFinite(quota) || quota < 0) {
    return NextResponse.json({ error: "yearly_quota must be non-negative" }, { status: 400 });
  }
  try {
    const [row] = await db()
      .insert(leaveTypes)
      .values({
        id: ulid(),
        organizationId: a.organizationId,
        outletId: null,
        name,
        isPaid: body.is_paid !== false,
        yearlyQuota: String(quota),
        isActive: body.is_active !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      })
      .returning();
    return NextResponse.json({ leave_type: row }, { status: 201, headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to create leave type" }, { status: 500 });
  }
}

/** PUT /api/payroll/leave-types?id= — rename, quota, active flag. */
export async function PUT(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const patch: Partial<typeof leaveTypes.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (v.length < 2) return NextResponse.json({ error: "name too short" }, { status: 400 });
      patch.name = v;
    }
    if (body.yearly_quota !== undefined) {
      const q = Number(body.yearly_quota);
      if (!Number.isFinite(q) || q < 0) {
        return NextResponse.json({ error: "yearly_quota must be non-negative" }, { status: 400 });
      }
      patch.yearlyQuota = String(q);
    }
    if (body.is_paid !== undefined) patch.isPaid = body.is_paid === true;
    if (body.is_active !== undefined) patch.isActive = body.is_active === true;
    const rows = await db()
      .update(leaveTypes)
      .set(patch)
      .where(and(eq(leaveTypes.id, id), eq(leaveTypes.organizationId, a.organizationId)))
      .returning();
    if (rows.length === 0) {
      return NextResponse.json({ error: "leave type not found" }, { status: 404 });
    }
    return NextResponse.json({ leave_type: rows[0] }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to update leave type" }, { status: 500 });
  }
}
