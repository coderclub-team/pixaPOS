import { NextResponse } from "next/server";
import { listPayPeriods, createPayPeriod } from "@/features/payroll/api/server";
import { payPeriodSchema } from "@/features/payroll/schemas/payroll";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";

export const dynamic = "force-dynamic";

/** GET /api/payroll/periods — newest first. */
export async function GET() {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  try {
    return NextResponse.json(
      { periods: await listPayPeriods(a.organizationId) },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json({ error: "failed to list pay periods" }, { status: 500 });
  }
}

/** POST /api/payroll/periods — create a draft period. */
export async function POST(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = payPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid pay period" }, { status: 400 });
  }
  try {
    const period = await createPayPeriod({
      organizationId: a.organizationId,
      startDate: parsed.data.start_date,
      endDate: parsed.data.end_date,
    });
    return NextResponse.json({ period }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ error: "failed to create pay period" }, { status: 500 });
  }
}
