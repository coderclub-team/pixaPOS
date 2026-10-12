import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, payrollRuns } from "@pixa/db";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { createPayrollRun, type RunInputUnit } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

/** GET /api/payroll/runs — newest first. */
export async function GET() {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  try {
    const rows = await db()
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.organizationId, a.organizationId))
      .orderBy(desc(payrollRuns.createdAt))
      .limit(100);
    return NextResponse.json({ runs: rows }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to list runs" }, { status: 500 });
  }
}

/**
 * POST /api/payroll/runs — compute a draft run for a period.
 * { pay_period_id, inputs?: [{ employee_id, working_units?, holiday_units? }] }
 * Salary staff default to full period days; hourly default to 0 hours.
 */
export async function POST(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  let body: { pay_period_id?: string; inputs?: RunInputUnit[] };
  try {
    body = (await req.json()) as { pay_period_id?: string; inputs?: RunInputUnit[] };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.pay_period_id) {
    return NextResponse.json({ error: "pay_period_id required" }, { status: 400 });
  }
  const inputs = body.inputs ?? [];
  for (const u of inputs) {
    if (!u.employee_id)
      return NextResponse.json({ error: "inputs need employee_id" }, { status: 400 });
    for (const k of ["working_units", "holiday_units"] as const) {
      const v = u[k];
      if (v !== undefined && (!Number.isFinite(v) || v < 0)) {
        return NextResponse.json({ error: `${k} must be non-negative` }, { status: 400 });
      }
    }
  }
  try {
    const result = await createPayrollRun(a.organizationId, body.pay_period_id, inputs, a.userId);
    return NextResponse.json({ ok: true, ...result }, { status: 201, headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: msg || "failed to create run" }, { status: 400 });
  }
}
