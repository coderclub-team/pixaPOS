import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, payPeriods, payrollRuns } from "@pixa/db";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";

export const dynamic = "force-dynamic";

/**
 * POST /api/payroll/runs/:id/approve — lock the run (read-only after) and
 * lock its pay period. Conditional flip: replays 409.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const { id } = await ctx.params;
  try {
    const database = db();
    const flipped = await database
      .update(payrollRuns)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.organizationId, a.organizationId),
          eq(payrollRuns.status, "draft"),
        ),
      )
      .returning({ id: payrollRuns.id, payPeriodId: payrollRuns.payPeriodId });
    if (flipped.length === 0) {
      return NextResponse.json({ error: "not found or already approved" }, { status: 409 });
    }
    await database
      .update(payPeriods)
      .set({ status: "locked", updatedAt: new Date() })
      .where(eq(payPeriods.id, flipped[0].payPeriodId));
    return NextResponse.json({ ok: true, id }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to approve run" }, { status: 500 });
  }
}
