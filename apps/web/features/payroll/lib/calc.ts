/**
 * Payroll calculation core — 100% pure functions, integer paise throughout
 * (ADR-0001). No imports from app code so this stays trivially testable.
 *
 * Formulas (per spec):
 * - Salary:  dailyRate = round(monthly / totalWorkingDays); wage = dailyRate × daysWorked
 * - Hourly:  wage = hours × rate
 * - Holiday: extra = round(holidayHours × hourlyRate × multiplier) + fixed
 *   (salaried staff use dailyRate/8 as the hourly equivalent — one standard shift)
 * - Unpaid:  deduction = unpaidDays × dailyRate  (half day = 0.5)
 * - Gross  = wage + holidayExtra + incentives
 * - Net    = gross − unpaid − otherDeductions
 */

export type PayType = "hourly" | "salary";
export type DayType = "full" | "first_half" | "second_half";

/** Standard shift length used to derive an hourly rate for salaried staff. */
export const SHIFT_HOURS = 8;

export function dailyRateForSalary(monthlyPaise: number, totalWorkingDays: number): number {
  if (!Number.isFinite(monthlyPaise) || monthlyPaise < 0) {
    throw new Error("monthly salary must be a non-negative number");
  }
  if (!Number.isInteger(totalWorkingDays) || totalWorkingDays < 1) {
    throw new Error("total working days must be a positive integer");
  }
  return Math.round(monthlyPaise / totalWorkingDays);
}

export function hourlyRateFor(payType: PayType, ratePaise: number, dailyRatePaise: number): number {
  if (payType === "hourly") return ratePaise;
  return Math.round(dailyRatePaise / SHIFT_HOURS);
}

export function grossWage(input: {
  payType: PayType;
  ratePaise: number;
  workingUnits: number; // hours (hourly) or days worked (salary)
  totalWorkingDays: number;
}): number {
  const { payType, ratePaise, workingUnits, totalWorkingDays } = input;
  if (!Number.isFinite(workingUnits) || workingUnits < 0) {
    throw new Error("working units must be a non-negative number");
  }
  if (payType === "hourly") {
    if (!Number.isInteger(ratePaise) || ratePaise < 0) {
      throw new Error("hourly rate must be non-negative integer paise");
    }
    return Math.round(workingUnits * ratePaise);
  }
  const daily = dailyRateForSalary(ratePaise, totalWorkingDays);
  return Math.round(daily * workingUnits);
}

export function holidayExtraPay(input: {
  holidayHours: number;
  hourlyRatePaise: number;
  multiplier: number;
  fixedPaise?: number;
}): number {
  const { holidayHours, hourlyRatePaise, multiplier, fixedPaise = 0 } = input;
  if (!Number.isFinite(holidayHours) || holidayHours < 0) {
    throw new Error("holiday hours must be a non-negative number");
  }
  if (!(multiplier > 0)) throw new Error("multiplier must be positive");
  if (!Number.isInteger(fixedPaise) || fixedPaise < 0) {
    throw new Error("fixed incentive must be non-negative integer paise");
  }
  return Math.round(holidayHours * hourlyRatePaise * multiplier) + fixedPaise;
}

export function unpaidLeaveDeduction(unpaidDays: number, dailyRatePaise: number): number {
  if (!Number.isFinite(unpaidDays) || unpaidDays < 0) {
    throw new Error("unpaid days must be a non-negative number");
  }
  if (!Number.isInteger(dailyRatePaise) || dailyRatePaise < 0) {
    throw new Error("daily rate must be non-negative integer paise");
  }
  return Math.round(unpaidDays * dailyRatePaise);
}

export interface PayslipInput {
  payType: PayType;
  /** Hourly rate (hourly staff) or monthly salary (salaried), in paise. */
  ratePaise: number;
  /** Hours worked (hourly) or days worked (salary). */
  workingUnits: number;
  /** Calendar working days in the period (salary daily-rate divisor). */
  totalWorkingDays: number;
  holidayUnits: number;
  unpaidLeaveDays: number;
  incentives: { name: string; amountPaise: number }[];
  otherDeductionsPaise?: number;
  holidayMultiplier?: number;
  holidayFixedPaise?: number;
}

export interface PayslipBreakdown {
  dailyRatePaise: number;
  grossWagePaise: number;
  holidayExtraPaise: number;
  incentivesTotalPaise: number;
  unpaidLeavePaise: number;
  grossPayPaise: number;
  deductionsPaise: number;
  netPayPaise: number;
}

export function calculatePayslip(input: PayslipInput): PayslipBreakdown {
  const {
    payType,
    ratePaise,
    workingUnits,
    totalWorkingDays,
    holidayUnits,
    unpaidLeaveDays,
    incentives,
    otherDeductionsPaise = 0,
    holidayMultiplier = 1.5,
    holidayFixedPaise = 0,
  } = input;
  if (!Number.isInteger(otherDeductionsPaise) || otherDeductionsPaise < 0) {
    throw new Error("other deductions must be non-negative integer paise");
  }
  for (const inc of incentives) {
    if (!Number.isInteger(inc.amountPaise) || inc.amountPaise < 0) {
      throw new Error(`incentive "${inc.name}" must be non-negative integer paise`);
    }
  }

  const dailyRatePaise =
    payType === "salary" ? dailyRateForSalary(ratePaise, totalWorkingDays) : ratePaise;
  const grossWagePaise = grossWage({ payType, ratePaise, workingUnits, totalWorkingDays });
  const holidayExtraPaise =
    holidayUnits > 0
      ? holidayExtraPay({
          holidayHours: holidayUnits,
          hourlyRatePaise: hourlyRateFor(payType, ratePaise, dailyRatePaise),
          multiplier: holidayMultiplier,
          fixedPaise: holidayFixedPaise,
        })
      : 0;
  const incentivesTotalPaise = incentives.reduce((s, i) => s + i.amountPaise, 0);
  const unpaidLeavePaise =
    unpaidLeaveDays > 0
      ? unpaidLeaveDeduction(
          unpaidLeaveDays,
          dailyRatePaiseForUnpaid(payType, ratePaise, dailyRatePaise),
        )
      : 0;

  const grossPayPaise = grossWagePaise + holidayExtraPaise + incentivesTotalPaise;
  const deductionsPaise = otherDeductionsPaise;
  const netPayPaise = grossPayPaise - unpaidLeavePaise - deductionsPaise;
  if (netPayPaise < 0) throw new Error("net pay cannot be negative — check inputs");
  return {
    dailyRatePaise,
    grossWagePaise,
    holidayExtraPaise,
    incentivesTotalPaise,
    unpaidLeavePaise,
    grossPayPaise,
    deductionsPaise,
    netPayPaise,
  };
}

/** Unpaid leave always prices off a daily rate (hourly staff: rate × shift). */
function dailyRatePaiseForUnpaid(
  payType: PayType,
  ratePaise: number,
  dailyRatePaise: number,
): number {
  return payType === "salary" ? dailyRatePaise : Math.round(ratePaise * SHIFT_HOURS);
}

/* ------------------------- leave day counting ------------------------- */

/** Inclusive YYYY-MM-DD date list for a range. */
export function datesInRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("dates must be YYYY-MM-DD");
  }
  if (end < start) throw new Error("end date cannot be before start date");
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Leave days for a request. A half-day type applies to single-day requests
 * (0.5); multi-day ranges always count full calendar days.
 */
export function leaveDaysForRequest(startDate: string, endDate: string, dayType: DayType): number {
  const days = datesInRange(startDate, endDate);
  if (days.length === 1 && dayType !== "full") return 0.5;
  return days.length;
}

/** Inclusive calendar-day count (salary daily-rate divisor default). */
export function calendarDaysBetween(startDate: string, endDate: string): number {
  return datesInRange(startDate, endDate).length;
}
