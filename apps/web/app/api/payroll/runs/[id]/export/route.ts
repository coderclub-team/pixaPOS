import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, employees, payrollItems, payrollRuns } from "@pixa/db";
import { payrollAuth } from "@/features/payroll/api/authz";

export const dynamic = "force-dynamic";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/payroll/runs/:id/export — summary CSV (amounts in rupees). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const { id } = await ctx.params;
  try {
    const database = db();
    const [run] = await database
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, id), eq(payrollRuns.organizationId, a.organizationId)))
      .limit(1);
    if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
    const rows = await database
      .select({
        item: payrollItems,
        employeeName: employees.name,
        employeeCode: employees.employeeCode,
      })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(eq(payrollItems.payrollRunId, id));
    const head = [
      "employee_code",
      "employee_name",
      "working_units",
      "holiday_units",
      "gross_wage",
      "holiday_extra",
      "incentives",
      "unpaid_leave_deduction",
      "gross_pay",
      "deductions",
      "net_pay",
      "status",
    ];
    const lines = [head.join(",")];
    for (const { item, employeeName, employeeCode } of rows) {
      lines.push(
        [
          employeeCode,
          employeeName,
          item.workingUnits,
          item.holidayUnits,
          (item.grossWagePaise / 100).toFixed(2),
          (item.holidayExtraPaise / 100).toFixed(2),
          (item.totalIncentivesPaise / 100).toFixed(2),
          (item.unpaidLeavePaise / 100).toFixed(2),
          (item.grossPayPaise / 100).toFixed(2),
          (item.deductionsPaise / 100).toFixed(2),
          (item.netPayPaise / 100).toFixed(2),
          run.status,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payroll-${id.slice(0, 8)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to export run" }, { status: 500 });
  }
}
