import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, payrollItems, payrollRuns } from "@pixa/db";
import { assertDraft, payrollAuth, noStore } from "@/features/payroll/api/authz";
import { refreshPayrollItemTotals, toPaise } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

/**
 * PUT /api/payroll/runs/:id/items/:itemId — admin override (draft only).
 * Accepts working_units, holiday_units, gross_wage (₹), holiday_extra (₹),
 * deductions (₹), notes. Totals re-derive after the patch.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const { id: runId, itemId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const database = db();
    const [run] = await database
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.organizationId, a.organizationId)))
      .limit(1);
    if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
    const locked = assertDraft(run.status);
    if (locked) return locked;
    const [item] = await database
      .select()
      .from(payrollItems)
      .where(and(eq(payrollItems.id, itemId), eq(payrollItems.payrollRunId, runId)))
      .limit(1);
    if (!item) return NextResponse.json({ error: "item not in this run" }, { status: 404 });

    const patch: Partial<typeof payrollItems.$inferInsert> = { updatedAt: new Date() };
    if (body.working_units !== undefined) {
      const v = Number(body.working_units);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: "working_units must be non-negative" }, { status: 400 });
      }
      patch.workingUnits = String(v);
    }
    if (body.holiday_units !== undefined) {
      const v = Number(body.holiday_units);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: "holiday_units must be non-negative" }, { status: 400 });
      }
      patch.holidayUnits = String(v);
    }
    for (const [key, col] of [
      ["gross_wage", "grossWagePaise"],
      ["holiday_extra", "holidayExtraPaise"],
      ["deductions", "deductionsPaise"],
    ] as const) {
      if (body[key] !== undefined) {
        try {
          (patch as Record<string, unknown>)[col] = toPaise(Number(body[key]));
        } catch {
          return NextResponse.json({ error: `${key} must be non-negative` }, { status: 400 });
        }
      }
    }
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;

    await database.update(payrollItems).set(patch).where(eq(payrollItems.id, itemId));
    await refreshPayrollItemTotals(itemId);
    const [updated] = await database
      .select()
      .from(payrollItems)
      .where(eq(payrollItems.id, itemId))
      .limit(1);
    return NextResponse.json({ item: updated }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to update item" }, { status: 500 });
  }
}
