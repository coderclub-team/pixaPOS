import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, employees, leaveRequests, leaveTypes } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { leaveDaysForRequest, type DayType } from "@/features/payroll/lib/calc";

export const dynamic = "force-dynamic";

const DAY_TYPES = ["full", "first_half", "second_half"] as const;

/** GET /api/payroll/leaves?employee_id=&status= — newest first. */
export async function GET(req: Request) {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  const q = new URL(req.url).searchParams;
  try {
    const conds = [eq(leaveRequests.organizationId, a.organizationId)];
    if (q.get("employee_id")) conds.push(eq(leaveRequests.employeeId, q.get("employee_id")!));
    if (q.get("status")) conds.push(eq(leaveRequests.status, q.get("status")!));
    const rows = await db()
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeName: employees.name,
        leaveTypeId: leaveRequests.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        dayType: leaveRequests.dayType,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        approvedBy: leaveRequests.approvedBy,
        approvedAt: leaveRequests.approvedAt,
        remarks: leaveRequests.remarks,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(...conds))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(500);
    return NextResponse.json({ leaves: rows }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to list leaves" }, { status: 500 });
  }
}

/** POST /api/payroll/leaves — apply. Half-day only valid for single-day. */
export async function POST(req: Request) {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const employeeId = String(body.employee_id ?? "");
  const leaveTypeId = String(body.leave_type_id ?? "");
  const startDate = String(body.start_date ?? "");
  const endDate = String(body.end_date ?? startDate);
  const dayType = String(body.day_type ?? "full");
  if (!employeeId || !leaveTypeId) {
    return NextResponse.json({ error: "employee_id and leave_type_id required" }, { status: 400 });
  }
  if (!(DAY_TYPES as readonly string[]).includes(dayType)) {
    return NextResponse.json(
      { error: "day_type must be full, first_half or second_half" },
      { status: 400 },
    );
  }
  let totalDays: number;
  try {
    totalDays = leaveDaysForRequest(startDate, endDate, dayType as DayType);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid dates" },
      { status: 400 },
    );
  }
  try {
    const database = db();
    const [emp] = await database
      .select({ id: employees.id, status: employees.status })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.organizationId, a.organizationId)))
      .limit(1);
    if (!emp) return NextResponse.json({ error: "employee not found" }, { status: 404 });
    if (emp.status !== "active") {
      return NextResponse.json({ error: "employee is not active" }, { status: 400 });
    }
    const [type] = await database
      .select({ id: leaveTypes.id })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.id, leaveTypeId), eq(leaveTypes.organizationId, a.organizationId)))
      .limit(1);
    if (!type) return NextResponse.json({ error: "leave type not found" }, { status: 404 });
    const [row] = await database
      .insert(leaveRequests)
      .values({
        id: ulid(),
        organizationId: a.organizationId,
        outletId: null,
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        totalDays: String(totalDays),
        dayType,
        reason: body.reason ? String(body.reason) : null,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      })
      .returning();
    return NextResponse.json({ leave: row }, { status: 201, headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to apply leave" }, { status: 500 });
  }
}
