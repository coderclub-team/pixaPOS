import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, holidayPayRules } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { toPaise } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

/** GET /api/payroll/holiday-rules — the active rule, if any. */
export async function GET() {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  try {
    const [rule] = await db()
      .select()
      .from(holidayPayRules)
      .where(
        and(
          eq(holidayPayRules.organizationId, a.organizationId),
          eq(holidayPayRules.isActive, true),
        ),
      )
      .limit(1);
    return NextResponse.json({ rule: rule ?? null }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to load rule" }, { status: 500 });
  }
}

/**
 * POST /api/payroll/holiday-rules — upsert the single active rule.
 * { multiplier: 1.5, fixed_incentive_amount: 500 (rupees, optional) }
 */
export async function POST(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const multiplier = Number(body.multiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return NextResponse.json({ error: "multiplier must be positive" }, { status: 400 });
  }
  let fixedPaise = 0;
  if (body.fixed_incentive_amount !== undefined) {
    try {
      fixedPaise = toPaise(Number(body.fixed_incentive_amount));
    } catch {
      return NextResponse.json(
        { error: "fixed_incentive_amount must be non-negative" },
        { status: 400 },
      );
    }
  }
  try {
    const database = db();
    const [existing] = await database
      .select()
      .from(holidayPayRules)
      .where(
        and(
          eq(holidayPayRules.organizationId, a.organizationId),
          eq(holidayPayRules.isActive, true),
        ),
      )
      .limit(1);
    const row = existing
      ? (
          await database
            .update(holidayPayRules)
            .set({
              multiplier: String(multiplier),
              fixedIncentivePaise: fixedPaise,
              updatedAt: new Date(),
            })
            .where(eq(holidayPayRules.id, existing.id))
            .returning()
        )[0]
      : (
          await database
            .insert(holidayPayRules)
            .values({
              id: ulid(),
              organizationId: a.organizationId,
              outletId: null,
              multiplier: String(multiplier),
              fixedIncentivePaise: fixedPaise,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              version: 1,
            })
            .returning()
        )[0];
    return NextResponse.json({ rule: row }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to save rule" }, { status: 500 });
  }
}
