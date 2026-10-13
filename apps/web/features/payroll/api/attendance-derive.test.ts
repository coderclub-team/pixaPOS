import { describe, expect, it } from "vitest";
import { deriveFromAttendance } from "./server";

const days = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04"];
const rec = (status: string, hours = 0) => ({ status, hours });
const empty = new Map<string, number>();

describe("deriveFromAttendance", () => {
  it("counts unmarked days as present units and tallies them", () => {
    const d = deriveFromAttendance(days, undefined, empty, empty);
    expect(d).toEqual({ units: 4, hours: 0, extraUnpaid: 0, unmarked: 4 });
  });

  it("prices absent without leave as unpaid, excuses paid-leave absence", () => {
    const m = new Map([
      ["2026-04-01", rec("present", 8)],
      ["2026-04-02", rec("absent")],
      ["2026-04-03", rec("absent")],
      ["2026-04-04", rec("half_day", 4)],
    ]);
    const paid = new Map([["2026-04-03", 1]]);
    const d = deriveFromAttendance(days, m, paid, empty);
    // 1 + 0 + 1(paid) + 0.5 = 2.5 units; unpaid: 04-02 full + 04-04 half = 1.5
    expect(d.units).toBe(2.5);
    expect(d.extraUnpaid).toBe(1.5);
    expect(d.hours).toBe(12);
    expect(d.unmarked).toBe(0);
  });

  it("never double-counts approved unpaid leave dates", () => {
    const m = new Map([["2026-04-01", rec("absent")]]);
    const unpaid = new Map([["2026-04-01", 1]]);
    const d = deriveFromAttendance(["2026-04-01"], m, empty, unpaid);
    expect(d.units).toBe(0);
    expect(d.extraUnpaid).toBe(0);
  });

  it("treats weekly_off and holiday as paid neutral days", () => {
    const m = new Map([
      ["2026-04-01", rec("weekly_off")],
      ["2026-04-02", rec("holiday")],
    ]);
    const d = deriveFromAttendance(["2026-04-01", "2026-04-02"], m, empty, empty);
    expect(d.units).toBe(2);
    expect(d.extraUnpaid).toBe(0);
  });

  it("covers a half-day absence with half paid leave", () => {
    const m = new Map([["2026-04-01", rec("half_day", 4)]]);
    const paid = new Map([["2026-04-01", 0.5]]);
    const d = deriveFromAttendance(["2026-04-01"], m, paid, empty);
    expect(d.units).toBe(1);
    expect(d.extraUnpaid).toBe(0);
  });
});
