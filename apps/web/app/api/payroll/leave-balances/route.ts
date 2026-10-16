import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, employees, leaveBalances, leaveTypes } from "@pixa/db";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { ensureBalances } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/payroll/leave-balances?employee_id=&year= — auto-seeds missing
 * rows from type quotas, then returns opening/used/remaining.
 */
export async function GET(req: Request) {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  const q = new URL(req.url).searchParams;
  const year = Number(q.get("year") ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "valid year required" }, { status: 400 });
  }
  try {
    await ensureBalances(a.organizationId, year);
    const conds = [
      eq(leaveBalances.organizationId, a.organizationId),
      eq(leaveBalances.year, year),
    ];
    const employeeId = q.get("employee_id");
    if (employeeId) conds.push(eq(leaveBalances.employeeId, employeeId));
    const rows = await db()
      .select({
        id: leaveBalances.id,
        employeeId: leaveBalances.employeeId,
        employeeName: employees.name,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        isPaid: leaveTypes.isPaid,
        year: leaveBalances.year,
        openingBalance: leaveBalances.openingBalance,
        used: leaveBalances.used,
        remaining: leaveBalances.remaining,
      })
      .from(leaveBalances)
      .innerJoin(employees, eq(leaveBalances.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .where(and(...conds));
    return NextResponse.json({ balances: rows }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to list balances" }, { status: 500 });
  }
}

/** PUT /api/payroll/leave-balances?id= — adjust opening balance (re-derives remaining). */
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
  if (body.opening_balance === undefined) {
    return NextResponse.json({ error: "opening_balance required" }, { status: 400 });
  }
  const opening = Number(body.opening_balance);
  if (!Number.isFinite(opening) || opening < 0) {
    return NextResponse.json({ error: "opening_balance must be non-negative" }, { status: 400 });
  }
  try {
    const [bal] = await db()
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.id, id), eq(leaveBalances.organizationId, a.organizationId)))
      .limit(1);
    if (!bal) return NextResponse.json({ error: "balance not found" }, { status: 404 });
    const used = Number(bal.used);
    if (opening < used) {
      return NextResponse.json({ error: "opening cannot go below used days" }, { status: 400 });
    }
    const [row] = await db()
      .update(leaveBalances)
      .set({
        openingBalance: String(opening),
        remaining: String(opening - used),
        updatedAt: new Date(),
      })
      .where(eq(leaveBalances.id, id))
      .returning();
    return NextResponse.json({ balance: row }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to update balance" }, { status: 500 });
  }
}
