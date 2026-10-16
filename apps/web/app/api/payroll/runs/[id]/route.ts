import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, employees, payrollIncentives, payrollItems, payrollRuns } from "@pixa/db";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";

export const dynamic = "force-dynamic";

/** GET /api/payroll/runs/:id — run + items (with employee names) + incentives. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await payrollAuth();
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
    const items = await database
      .select({
        item: payrollItems,
        employeeName: employees.name,
        employeeCode: employees.employeeCode,
      })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(eq(payrollItems.payrollRunId, id));
    const incs = await database
      .select()
      .from(payrollIncentives)
      .where(eq(payrollIncentives.organizationId, a.organizationId));
    const byItem = new Map<string, typeof incs>();
    for (const inc of incs) {
      const list = byItem.get(inc.payrollItemId) ?? [];
      list.push(inc);
      byItem.set(inc.payrollItemId, list);
    }
    return NextResponse.json(
      {
        run,
        items: items.map(({ item, employeeName, employeeCode }) => ({
          ...item,
          employee_name: employeeName,
          employee_code: employeeCode,
          incentives: byItem.get(item.id) ?? [],
        })),
      },
      { headers: noStore },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to load run" }, { status: 500 });
  }
}
