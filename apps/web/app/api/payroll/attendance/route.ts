import { NextResponse } from "next/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { attendanceDays, db, employees } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";

export const dynamic = "force-dynamic";

const STATUSES = ["present", "absent", "half_day", "weekly_off", "holiday"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** GET /api/payroll/attendance?month=YYYY-MM&employee_id= — month register. */
export async function GET(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const q = new URL(req.url).searchParams;
  const month = q.get("month") ?? todayStr().slice(0, 7);
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  try {
    const [y, m] = month.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    const conds = [
      eq(attendanceDays.organizationId, a.organizationId),
      gte(attendanceDays.date, `${month}-01`),
      lt(attendanceDays.date, `${nextMonth}-01`),
    ];
    if (q.get("employee_id")) conds.push(eq(attendanceDays.employeeId, q.get("employee_id")!));
    const rows = await db()
      .select()
      .from(attendanceDays)
      .where(and(...conds));
    return NextResponse.json({ days: rows }, { headers: noStore });
  } catch (e) {
    if (process.env.VITEST_WORKER_ID) {
      const msg = e instanceof Error ? e.message : String(e);
      const cause = e instanceof Error && e.cause ? String(e.cause).slice(0, 200) : "";
      return NextResponse.json(
        { error: `failed to list attendance: ${msg.slice(0, 200)} || ${cause}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "failed to list attendance" }, { status: 500 });
  }
}

/**
 * POST /api/payroll/attendance — upsert day records (manager-marked register).
 * { days: [{ employee_id, date, status, hours?, notes? }] }
 * Rules: past/today only (no future marking), hours 0–24, employees must
 * belong to this org. Upsert on (org, employee, date).
 */
export async function POST(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  let body: { days?: unknown };
  try {
    body = (await req.json()) as { days?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.days) || body.days.length === 0) {
    return NextResponse.json({ error: "days[] required" }, { status: 400 });
  }
  if (body.days.length > 1000) {
    return NextResponse.json({ error: "max 1000 records per request" }, { status: 400 });
  }
  const today = todayStr();
  const clean: {
    employeeId: string;
    date: string;
    status: string;
    hours: string;
    notes: string | null;
  }[] = [];
  for (const d of body.days as Record<string, unknown>[]) {
    const employeeId = String(d.employee_id ?? "");
    const date = String(d.date ?? "");
    const status = String(d.status ?? "");
    if (!employeeId) return NextResponse.json({ error: "employee_id required" }, { status: 400 });
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: `bad date ${date} (YYYY-MM-DD)` }, { status: 400 });
    }
    if (date > today) {
      return NextResponse.json({ error: `cannot mark future date ${date}` }, { status: 400 });
    }
    if (!(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `status must be ${STATUSES.join(" | ")}` },
        { status: 400 },
      );
    }
    const hours = d.hours === undefined || d.hours === "" ? 0 : Number(d.hours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return NextResponse.json({ error: "hours must be 0–24" }, { status: 400 });
    }
    clean.push({
      employeeId,
      date,
      status,
      hours: String(hours),
      notes: d.notes ? String(d.notes).slice(0, 200) : null,
    });
  }
  try {
    const database = db();
    const empIds = [...new Set(clean.map((c) => c.employeeId))];
    for (const empId of empIds) {
      const [emp] = await database
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.id, empId), eq(employees.organizationId, a.organizationId)))
        .limit(1);
      if (!emp) return NextResponse.json({ error: `unknown employee ${empId}` }, { status: 400 });
    }
    for (const c of clean) {
      await database
        .insert(attendanceDays)
        .values({
          id: ulid(),
          organizationId: a.organizationId,
          outletId: null,
          employeeId: c.employeeId,
          date: c.date,
          status: c.status,
          hours: c.hours,
          markedBy: a.userId,
          markedAt: new Date(),
          notes: c.notes,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        })
        .onConflictDoUpdate({
          target: [attendanceDays.organizationId, attendanceDays.employeeId, attendanceDays.date],
          set: {
            status: c.status,
            hours: c.hours,
            notes: c.notes,
            markedBy: a.userId,
            markedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }
    return NextResponse.json({ ok: true, saved: clean.length }, { status: 201, headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to save attendance" }, { status: 500 });
  }
}
