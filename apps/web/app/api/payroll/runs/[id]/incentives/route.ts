import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, payrollIncentives, payrollItems, payrollRuns } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { assertDraft, payrollAuth, noStore } from "@/features/payroll/api/authz";
import { refreshPayrollItemTotals, toPaise } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

/** POST /api/payroll/runs/:id/incentives — { payroll_item_id, name, amount (₹), note? }. Draft only. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const { id: runId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const itemId = String(body.payroll_item_id ?? "");
  const name = String(body.name ?? "").trim();
  if (!itemId || name.length < 2) {
    return NextResponse.json({ error: "payroll_item_id and name required" }, { status: 400 });
  }
  let amountPaise: number;
  try {
    amountPaise = toPaise(Number(body.amount));
  } catch {
    return NextResponse.json({ error: "amount must be non-negative" }, { status: 400 });
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
    const [row] = await database
      .insert(payrollIncentives)
      .values({
        id: ulid(),
        organizationId: a.organizationId,
        payrollItemId: itemId,
        name,
        amountPaise,
        note: body.note ? String(body.note) : null,
        createdAt: new Date(),
      })
      .returning();
    await refreshPayrollItemTotals(itemId);
    return NextResponse.json({ incentive: row }, { status: 201, headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to add incentive" }, { status: 500 });
  }
}

/** DELETE /api/payroll/runs/:id/incentives?incentive_id= — remove (draft only). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const { id: runId } = await ctx.params;
  const incentiveId = new URL(req.url).searchParams.get("incentive_id") ?? "";
  if (!incentiveId) return NextResponse.json({ error: "incentive_id required" }, { status: 400 });
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
    const [inc] = await database
      .select()
      .from(payrollIncentives)
      .where(
        and(
          eq(payrollIncentives.id, incentiveId),
          eq(payrollIncentives.organizationId, a.organizationId),
        ),
      )
      .limit(1);
    if (!inc) return NextResponse.json({ error: "incentive not found" }, { status: 404 });
    // Ensure the incentive belongs to this run.
    const [owner] = await database
      .select()
      .from(payrollItems)
      .where(and(eq(payrollItems.id, inc.payrollItemId), eq(payrollItems.payrollRunId, runId)))
      .limit(1);
    if (!owner) return NextResponse.json({ error: "incentive not in this run" }, { status: 404 });
    await database.delete(payrollIncentives).where(eq(payrollIncentives.id, incentiveId));
    await refreshPayrollItemTotals(inc.payrollItemId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to delete incentive" }, { status: 500 });
  }
}
