import { NextResponse } from "next/server";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { approveLeave } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

/** POST /api/payroll/leaves/:id/approve — deducts balance when paid. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await payrollAuth("org:leave:approve");
  if (a instanceof NextResponse) return a;
  const { id } = await ctx.params;
  let remarks: string | undefined;
  try {
    const body = (await req.json()) as { remarks?: string };
    remarks = body.remarks ? String(body.remarks) : undefined;
  } catch {
    remarks = undefined;
  }
  try {
    const result = await approveLeave(a.organizationId, id, a.userId, remarks);
    return NextResponse.json(result.body, { status: result.status, headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to approve leave" }, { status: 500 });
  }
}
