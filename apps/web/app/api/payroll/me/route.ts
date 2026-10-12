import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import {
  baUser,
  db,
  employees,
  leaveBalances,
  leaveRequests,
  leaveTypes,
  payrollItems,
  payrollRuns,
} from "@pixa/db";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { decryptBankAccount, maskBankAccount } from "@/lib/bank-crypto";
import { ensureBalances } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

/** Resolve the caller's employee record by session email. */
async function myEmployee(organizationId: string, email: string | null | undefined) {
  if (!email) return null;
  const [row] = await db()
    .select()
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), eq(employees.email, email)))
    .limit(1);
  return row ?? null;
}

/** GET /api/payroll/me — own profile (bank masked), balances, requests, payslips. */
export async function GET(req: Request) {
  const a = await payrollAuth();
  if (a instanceof NextResponse) return a;
  const view = new URL(req.url).searchParams.get("view") ?? "profile";
  try {
    const database = db();
    const me = a as { userId: string; organizationId: string };
    const [userRow] = await database
      .select({ email: baUser.email })
      .from(baUser)
      .where(eq(baUser.id, me.userId))
      .limit(1);
    const emp = await myEmployee(me.organizationId, userRow?.email);
    if (!emp) return NextResponse.json({ employee: null }, { headers: noStore });

    let bankMasked = "—";
    try {
      bankMasked = maskBankAccount(
        emp.bankAccountEnc ? await decryptBankAccount(emp.bankAccountEnc) : null,
      );
    } catch {
      bankMasked = "•••• (unreadable)";
    }
    const { bankAccountEnc: _drop, ...profile } = emp;
    void _drop;

    if (view === "balances") {
      const year = Number(new URL(req.url).searchParams.get("year") ?? new Date().getFullYear());
      await ensureBalances(me.organizationId, year);
      const rows = await database
        .select({
          leaveTypeName: leaveTypes.name,
          isPaid: leaveTypes.isPaid,
          year: leaveBalances.year,
          openingBalance: leaveBalances.openingBalance,
          used: leaveBalances.used,
          remaining: leaveBalances.remaining,
        })
        .from(leaveBalances)
        .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
        .where(and(eq(leaveBalances.employeeId, emp.id), eq(leaveBalances.year, year)));
      return NextResponse.json({ balances: rows }, { headers: noStore });
    }

    if (view === "leaves") {
      const rows = await database
        .select({
          id: leaveRequests.id,
          leaveTypeName: leaveTypes.name,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
          totalDays: leaveRequests.totalDays,
          dayType: leaveRequests.dayType,
          status: leaveRequests.status,
          remarks: leaveRequests.remarks,
          createdAt: leaveRequests.createdAt,
        })
        .from(leaveRequests)
        .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .where(eq(leaveRequests.employeeId, emp.id))
        .orderBy(desc(leaveRequests.createdAt))
        .limit(200);
      return NextResponse.json({ leaves: rows }, { headers: noStore });
    }

    if (view === "payslips") {
      const rows = await database
        .select({
          item: payrollItems,
          runStatus: payrollRuns.status,
          periodId: payrollRuns.payPeriodId,
        })
        .from(payrollItems)
        .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
        .where(eq(payrollItems.employeeId, emp.id))
        .orderBy(desc(payrollRuns.createdAt))
        .limit(50);
      return NextResponse.json(
        {
          payslips: rows.map(({ item, runStatus, periodId }) => ({
            ...item,
            run_status: runStatus,
            pay_period_id: periodId,
          })),
        },
        { headers: noStore },
      );
    }

    return NextResponse.json(
      { employee: { ...profile, bank_account_masked: bankMasked } },
      { headers: noStore },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to load profile" }, { status: 500 });
  }
}
