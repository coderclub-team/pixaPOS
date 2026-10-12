import { describe, expect, it } from "vitest";
import {
  calculatePayslip,
  calendarDaysBetween,
  dailyRateForSalary,
  datesInRange,
  grossWage,
  holidayExtraPay,
  leaveDaysForRequest,
  unpaidLeaveDeduction,
} from "./calc";

describe("dailyRateForSalary", () => {
  it("divides monthly salary by working days, rounded", () => {
    // ₹30,000 / 26 days = ₹1153.846... → 115385 paise
    expect(dailyRateForSalary(3_000_000, 26)).toBe(115385);
  });

  it("rejects bad inputs", () => {
    expect(() => dailyRateForSalary(-1, 26)).toThrow();
    expect(() => dailyRateForSalary(3_000_000, 0)).toThrow();
    expect(() => dailyRateForSalary(3_000_000, 26.5)).toThrow();
  });
});

describe("grossWage", () => {
  it("hourly: hours × rate", () => {
    expect(
      grossWage({ payType: "hourly", ratePaise: 15000, workingUnits: 8, totalWorkingDays: 26 }),
    ).toBe(120000);
  });

  it("salary: daily rate × days worked", () => {
    // daily 115385 × 24 days = 2769240
    expect(
      grossWage({
        payType: "salary",
        ratePaise: 3_000_000,
        workingUnits: 24,
        totalWorkingDays: 26,
      }),
    ).toBe(115385 * 24);
  });

  it("rejects negative working units", () => {
    expect(() =>
      grossWage({ payType: "hourly", ratePaise: 15000, workingUnits: -1, totalWorkingDays: 26 }),
    ).toThrow();
  });
});

describe("holidayExtraPay", () => {
  it("applies multiplier plus fixed incentive", () => {
    // 8h × ₹150 × 1.5 = ₹1800 → 180000 + 50000 fixed = 230000
    expect(
      holidayExtraPay({
        holidayHours: 8,
        hourlyRatePaise: 15000,
        multiplier: 1.5,
        fixedPaise: 50000,
      }),
    ).toBe(230000);
  });

  it("works with zero hours and no fixed amount", () => {
    expect(holidayExtraPay({ holidayHours: 0, hourlyRatePaise: 15000, multiplier: 2 })).toBe(0);
  });

  it("rejects non-positive multiplier", () => {
    expect(() =>
      holidayExtraPay({ holidayHours: 8, hourlyRatePaise: 15000, multiplier: 0 }),
    ).toThrow();
  });
});

describe("unpaidLeaveDeduction", () => {
  it("prices full and half days off the daily rate", () => {
    expect(unpaidLeaveDeduction(2, 115385)).toBe(230770);
    expect(unpaidLeaveDeduction(0.5, 115385)).toBe(57693); // round(57692.5)
  });
});

describe("calculatePayslip", () => {
  it("full salaried example follows Gross = wage + holiday + incentives; Net = gross − unpaid − deductions", () => {
    const r = calculatePayslip({
      payType: "salary",
      ratePaise: 3_000_000,
      workingUnits: 24,
      totalWorkingDays: 26,
      holidayUnits: 8,
      unpaidLeaveDays: 1.5,
      incentives: [{ name: "Festival bonus", amountPaise: 200000 }],
      otherDeductionsPaise: 50000,
      holidayMultiplier: 1.5,
      holidayFixedPaise: 0,
    });
    const daily = 115385;
    const wage = daily * 24;
    const holiday = Math.round(8 * Math.round(daily / 8) * 1.5);
    const unpaid = Math.round(1.5 * daily);
    expect(r.dailyRatePaise).toBe(daily);
    expect(r.grossWagePaise).toBe(wage);
    expect(r.holidayExtraPaise).toBe(holiday);
    expect(r.incentivesTotalPaise).toBe(200000);
    expect(r.unpaidLeavePaise).toBe(unpaid);
    expect(r.grossPayPaise).toBe(wage + holiday + 200000);
    expect(r.netPayPaise).toBe(wage + holiday + 200000 - unpaid - 50000);
  });

  it("hourly example with no extras", () => {
    const r = calculatePayslip({
      payType: "hourly",
      ratePaise: 12000,
      workingUnits: 160,
      totalWorkingDays: 26,
      holidayUnits: 0,
      unpaidLeaveDays: 0,
      incentives: [],
    });
    expect(r.grossWagePaise).toBe(160 * 12000);
    expect(r.holidayExtraPaise).toBe(0);
    expect(r.netPayPaise).toBe(160 * 12000);
  });

  it("rejects negative net pay and bad incentives", () => {
    expect(() =>
      calculatePayslip({
        payType: "hourly",
        ratePaise: 100,
        workingUnits: 1,
        totalWorkingDays: 26,
        holidayUnits: 0,
        unpaidLeaveDays: 0,
        incentives: [],
        otherDeductionsPaise: 999999,
      }),
    ).toThrow(/negative/);
    expect(() =>
      calculatePayslip({
        payType: "hourly",
        ratePaise: 100,
        workingUnits: 1,
        totalWorkingDays: 26,
        holidayUnits: 0,
        unpaidLeaveDays: 0,
        incentives: [{ name: "x", amountPaise: -5 }],
      }),
    ).toThrow();
  });
});

describe("leave day counting", () => {
  it("single-day half-day requests count 0.5", () => {
    expect(leaveDaysForRequest("2026-01-10", "2026-01-10", "first_half")).toBe(0.5);
    expect(leaveDaysForRequest("2026-01-10", "2026-01-10", "second_half")).toBe(0.5);
    expect(leaveDaysForRequest("2026-01-10", "2026-01-10", "full")).toBe(1);
  });

  it("multi-day ranges count inclusive calendar days", () => {
    expect(leaveDaysForRequest("2026-01-10", "2026-01-12", "full")).toBe(3);
    expect(leaveDaysForRequest("2026-01-10", "2026-01-12", "first_half")).toBe(3);
  });

  it("rejects reversed or invalid dates", () => {
    expect(() => leaveDaysForRequest("2026-01-12", "2026-01-10", "full")).toThrow();
    expect(() => datesInRange("not-a-date", "2026-01-10")).toThrow();
  });

  it("calendarDaysBetween counts inclusively", () => {
    expect(calendarDaysBetween("2026-02-01", "2026-02-28")).toBe(28);
  });
});
