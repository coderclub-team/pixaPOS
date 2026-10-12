import { and, eq } from "drizzle-orm";
import { db } from "@pixa/db";
import { ulid as mkid } from "@pixa/contracts";
import {
  employees,
  holidayPayRules,
  leaveBalances,
  leaveRequests,
  leaveTypes,
  payPeriods,
  payrollIncentives,
  payrollItems,
  payrollRuns,
  publicHolidays,
} from "@pixa/db";
import {
  calculatePayslip,
  calendarDaysBetween,
  datesInRange,
  leaveDaysForRequest,
  type DayType,
} from "../lib/calc";

const now = () => new Date();

/** Rupees → paise, banker's caution: round half up. */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) throw new Error("amount must be non-negative");
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}

/* ------------------------- leave balances ------------------------- */

/** Ensure a balance row exists for every (active employee × active type) pair. */
export async function ensureBalances(organizationId: string, year: number): Promise<void> {
  const database = db();
  const [emps, types] = await Promise.all([
    database
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.organizationId, organizationId), eq(employees.status, "active"))),
    database
      .select({ id: leaveTypes.id, quota: leaveTypes.yearlyQuota })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.organizationId, organizationId), eq(leaveTypes.isActive, true))),
  ]);
  const existing = await database
    .select({ employeeId: leaveBalances.employeeId, leaveTypeId: leaveBalances.leaveTypeId })
    .from(leaveBalances)
    .where(and(eq(leaveBalances.organizationId, organizationId), eq(leaveBalances.year, year)));
  const seen = new Set(existing.map((e) => `${e.employeeId}|${e.leaveTypeId}`));
  for (const e of emps) {
    for (const t of types) {
      if (seen.has(`${e.id}|${t.id}`)) continue;
      const opening = Number(t.quota ?? 0);
      await database.insert(leaveBalances).values({
        id: mkid(),
        organizationId,
        employeeId: e.id,
        leaveTypeId: t.id,
        year,
        openingBalance: String(opening),
        used: "0",
        remaining: String(opening),
        createdAt: now(),
        updatedAt: now(),
      });
      seen.add(`${e.id}|${t.id}`);
    }
  }
}

/* ------------------------- leave approval ------------------------- */

export interface LeaveDecision {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Approve a pending request: conditional status flip (idempotent — replays
 * 409) then deduct from the paid balance. Unpaid types skip deduction;
 * their days flow into payroll via request overlap instead.
 */
export async function approveLeave(
  organizationId: string,
  requestId: string,
  actorId: string,
  remarks?: string,
): Promise<LeaveDecision> {
  const database = db();
  const [req] = await database
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.organizationId, organizationId)))
    .limit(1);
  if (!req) return { ok: false, status: 404, body: { error: "leave request not found" } };
  if (req.status !== "pending") {
    return { ok: false, status: 409, body: { error: `already ${req.status}` } };
  }
  const [type] = await database
    .select()
    .from(leaveTypes)
    .where(eq(leaveTypes.id, req.leaveTypeId))
    .limit(1);
  if (!type) return { ok: false, status: 400, body: { error: "leave type missing" } };

  const days = Number(req.totalDays);
  if (type.isPaid) {
    const year = new Date(`${req.startDate}T00:00:00Z`).getUTCFullYear();
    await ensureBalances(organizationId, year);
    const [bal] = await database
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, req.employeeId),
          eq(leaveBalances.leaveTypeId, req.leaveTypeId),
          eq(leaveBalances.year, year),
        ),
      )
      .limit(1);
    if (!bal) return { ok: false, status: 400, body: { error: "no balance row" } };
    if (Number(bal.remaining) < days) {
      return { ok: false, status: 400, body: { error: "insufficient leave balance" } };
    }
    const used = Number(bal.used) + days;
    await database
      .update(leaveBalances)
      .set({
        used: String(used),
        remaining: String(Number(bal.openingBalance) - used),
        updatedAt: now(),
      })
      .where(eq(leaveBalances.id, bal.id));
  }

  // Conditional flip: concurrent approvals can't double-deduct.
  const flipped = await database
    .update(leaveRequests)
    .set({ status: "approved", approvedBy: actorId, approvedAt: now(), remarks, updatedAt: now() })
    .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.status, "pending")))
    .returning({ id: leaveRequests.id });
  if (flipped.length === 0) {
    return { ok: false, status: 409, body: { error: "already decided" } };
  }
  return { ok: true, status: 200, body: { ok: true, id: requestId, days } };
}

export async function rejectLeave(
  organizationId: string,
  requestId: string,
  actorId: string,
  remarks?: string,
): Promise<LeaveDecision> {
  const database = db();
  const flipped = await database
    .update(leaveRequests)
    .set({ status: "rejected", approvedBy: actorId, approvedAt: now(), remarks, updatedAt: now() })
    .where(
      and(
        eq(leaveRequests.id, requestId),
        eq(leaveRequests.organizationId, organizationId),
        eq(leaveRequests.status, "pending"),
      ),
    )
    .returning({ id: leaveRequests.id });
  if (flipped.length === 0) {
    return { ok: false, status: 409, body: { error: "not found or already decided" } };
  }
  return { ok: true, status: 200, body: { ok: true, id: requestId } };
}

/* ------------------------- payroll run ------------------------- */

export interface RunInputUnit {
  employee_id: string;
  working_units?: number;
  holiday_units?: number;
}

interface ComputedItem {
  employeeId: string;
  outletId: string | null;
  workingUnits: number;
  holidayUnits: number;
  breakdown: ReturnType<typeof calculatePayslip>;
  dailyRatePaise: number;
  unpaidDays: number;
}

/** Approved unpaid-leave days of an employee overlapping [start, end]. */
async function unpaidDaysInPeriod(
  organizationId: string,
  employeeId: string,
  start: string,
  end: string,
): Promise<number> {
  const database = db();
  const reqs = await database
    .select({
      id: leaveRequests.id,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      dayType: leaveRequests.dayType,
      isPaid: leaveTypes.isPaid,
    })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(
      and(
        eq(leaveRequests.organizationId, organizationId),
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, "approved"),
        eq(leaveTypes.isPaid, false),
      ),
    );
  const period = new Set(datesInRange(start, end));
  let total = 0;
  for (const r of reqs) {
    const overlap = datesInRange(String(r.startDate), String(r.endDate)).filter((d) =>
      period.has(d),
    );
    if (overlap.length === 0) continue;
    if (overlap.length === 1 && String(r.startDate) === String(r.endDate) && r.dayType !== "full") {
      total += 0.5;
    } else {
      total += overlap.length;
    }
  }
  return total;
}

async function activeHolidayRule(
  organizationId: string,
): Promise<{ multiplier: number; fixedPaise: number }> {
  const database = db();
  const [rule] = await database
    .select()
    .from(holidayPayRules)
    .where(
      and(eq(holidayPayRules.organizationId, organizationId), eq(holidayPayRules.isActive, true)),
    )
    .limit(1);
  return {
    multiplier: rule ? Number(rule.multiplier) : 1.5,
    fixedPaise: rule?.fixedIncentivePaise ?? 0,
  };
}

export async function computeRunItems(
  organizationId: string,
  periodId: string,
  units: RunInputUnit[],
): Promise<{ period: { start: string; end: string }; items: ComputedItem[] }> {
  const database = db();
  const [period] = await database
    .select()
    .from(payPeriods)
    .where(and(eq(payPeriods.id, periodId), eq(payPeriods.organizationId, organizationId)))
    .limit(1);
  if (!period) throw new Error("pay period not found");
  if (period.status !== "open") throw new Error("pay period is locked");
  const start = String(period.startDate);
  const end = String(period.endDate);
  const totalWorkingDays = calendarDaysBetween(start, end);
  const rule = await activeHolidayRule(organizationId);

  const emps = await database
    .select()
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), eq(employees.status, "active")));
  const byId = new Map(units.map((u) => [u.employee_id, u]));

  const items: ComputedItem[] = [];
  for (const e of emps) {
    const u = byId.get(e.id);
    const workingUnits = u?.working_units ?? (e.payType === "salary" ? totalWorkingDays : 0);
    const holidayUnits = u?.holiday_units ?? 0;
    const unpaidDays = await unpaidDaysInPeriod(organizationId, e.id, start, end);
    const breakdown = calculatePayslip({
      payType: e.payType as "hourly" | "salary",
      ratePaise: e.ratePaise,
      workingUnits,
      totalWorkingDays,
      holidayUnits,
      unpaidLeaveDays: unpaidDays,
      incentives: [],
      holidayMultiplier: rule.multiplier,
      holidayFixedPaise: rule.fixedPaise,
    });
    items.push({
      employeeId: e.id,
      outletId: e.outletId,
      workingUnits,
      holidayUnits,
      breakdown,
      dailyRatePaise: breakdown.dailyRatePaise,
      unpaidDays,
    });
  }
  return { period: { start, end }, items };
}

export async function createPayrollRun(
  organizationId: string,
  periodId: string,
  units: RunInputUnit[],
  createdBy: string,
): Promise<{ runId: string; itemCount: number }> {
  const database = db();
  const existing = await database
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(eq(payrollRuns.payPeriodId, periodId))
    .limit(1);
  if (existing.length > 0) throw new Error("a run already exists for this period");

  const { items } = await computeRunItems(organizationId, periodId, units);
  const runId = mkid();
  await database.insert(payrollRuns).values({
    id: runId,
    organizationId,
    outletId: null,
    payPeriodId: periodId,
    status: "draft",
    totalGrossPaise: items.reduce((s, i) => s + i.breakdown.grossPayPaise, 0),
    totalNetPaise: items.reduce((s, i) => s + i.breakdown.netPayPaise, 0),
    createdBy,
    createdAt: now(),
    updatedAt: now(),
    version: 1,
  });
  for (const item of items) {
    await database.insert(payrollItems).values({
      id: mkid(),
      organizationId,
      payrollRunId: runId,
      employeeId: item.employeeId,
      workingUnits: String(item.workingUnits),
      holidayUnits: String(item.holidayUnits),
      grossWagePaise: item.breakdown.grossWagePaise,
      holidayExtraPaise: item.breakdown.holidayExtraPaise,
      totalIncentivesPaise: 0,
      unpaidLeavePaise: item.breakdown.unpaidLeavePaise,
      grossPayPaise: item.breakdown.grossPayPaise,
      deductionsPaise: 0,
      netPayPaise: item.breakdown.netPayPaise,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  return { runId, itemCount: items.length };
}

/** Recompute an item's totals from its stored parts + incentives. */
export async function refreshPayrollItemTotals(itemId: string): Promise<void> {
  const database = db();
  const [item] = await database
    .select()
    .from(payrollItems)
    .where(eq(payrollItems.id, itemId))
    .limit(1);
  if (!item) throw new Error("payroll item not found");
  const incs = await database
    .select()
    .from(payrollIncentives)
    .where(eq(payrollIncentives.payrollItemId, itemId));
  const totalInc = incs.reduce((s, i) => s + i.amountPaise, 0);
  const gross = item.grossWagePaise + item.holidayExtraPaise + totalInc;
  await database
    .update(payrollItems)
    .set({
      totalIncentivesPaise: totalInc,
      grossPayPaise: gross,
      netPayPaise: gross - item.unpaidLeavePaise - item.deductionsPaise,
      updatedAt: now(),
    })
    .where(eq(payrollItems.id, itemId));
  // Roll up run totals.
  const siblings = await database
    .select()
    .from(payrollItems)
    .where(eq(payrollItems.payrollRunId, item.payrollRunId));
  await database
    .update(payrollRuns)
    .set({
      totalGrossPaise: siblings.reduce((s, i) => s + i.grossPayPaise, 0),
      totalNetPaise: siblings.reduce((s, i) => s + i.netPayPaise, 0),
      updatedAt: now(),
    })
    .where(eq(payrollRuns.id, item.payrollRunId));
}

export { leaveDaysForRequest, type DayType };

export interface PayPeriodInput {
  organizationId: string;
  startDate: string;
  endDate: string;
}

/** Newest-first periods for an org. */
export async function listPayPeriods(organizationId: string) {
  const database = db();
  return database
    .select()
    .from(payPeriods)
    .where(eq(payPeriods.organizationId, organizationId))
    .orderBy(payPeriods.startDate);
}

/** Create an open pay period. */
export async function createPayPeriod(input: PayPeriodInput) {
  const database = db();
  const [row] = await database
    .insert(payPeriods)
    .values({
      id: mkid(),
      organizationId: input.organizationId,
      outletId: null,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    })
    .returning();
  return row;
}
