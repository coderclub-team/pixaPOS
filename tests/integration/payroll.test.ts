/**
 * Integration: payroll API (employees, leave flow, holidays, runs) against
 * the isolated test database. Auth boundary stubbed; persistence is real.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { mockBaSession, mockBaOrgId, mockBaHas } = vi.hoisted(() => ({
  mockBaSession: vi.fn(),
  mockBaOrgId: vi.fn(),
  mockBaHas: vi.fn(),
}));
vi.mock("@pixa/server", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    baSession: mockBaSession,
    baOrgId: mockBaOrgId,
    baHas: mockBaHas,
    baUser: vi.fn(async () => null),
    baMemberRole: vi.fn(async () => null),
    requireBaUser: vi.fn(async () => {
      throw new Error("redirect");
    }),
  };
});
vi.mock("@pixa/db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const { getTestDb } = await import("../helpers/db");
  return { ...original, db: () => getTestDb() };
});

import { POST as createEmployee } from "@/app/api/payroll/employees/route";
import { POST as verifyEmployee } from "@/app/api/payroll/employees/[id]/verify/route";
import { GET as listAttendance, POST as markAttendance } from "@/app/api/payroll/attendance/route";
import { POST as applyLeave } from "@/app/api/payroll/leaves/route";
import { POST as approveLeave } from "@/app/api/payroll/leaves/[id]/approve/route";
import { POST as createPeriod } from "@/app/api/payroll/periods/route";
import { POST as createRun } from "@/app/api/payroll/runs/route";
import { POST as approveRun } from "@/app/api/payroll/runs/[id]/approve/route";
import { GET as runDetail } from "@/app/api/payroll/runs/[id]/route";
import { POST as addIncentive } from "@/app/api/payroll/runs/[id]/incentives/route";
import { getTestDb, resetTestDb, testId } from "../helpers/db";
import {
  baMember,
  baOrganization,
  baUser,
  employees,
  leaveBalances,
  leaveTypes,
  payrollItems,
  payrollRuns,
} from "@pixa/db";

const ORG = "org_payroll_test";

async function authedAdmin() {
  const database = getTestDb();
  const userId = testId("user");
  await database
    .insert(baUser)
    .values({
      id: userId,
      name: "Payroll Tester",
      email: `${userId}@test.local`,
      emailVerified: true,
    })
    .onConflictDoNothing();
  mockBaSession.mockResolvedValue({ user: { id: userId } });
  mockBaOrgId.mockResolvedValue(ORG);
  mockBaHas.mockResolvedValue(true);
}

function req(body: unknown, params = "") {
  return new Request(`http://test.local/api/x${params}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("payroll API", () => {
  beforeAll(() => {
    // bank-crypto derives its key from this; test-only value.
    vi.stubEnv("BETTER_AUTH_SECRET", "payroll-test-secret-please-change");
  });

  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();
    const database = getTestDb();
    await database
      .insert(baOrganization)
      .values({
        id: ORG,
        name: "Payroll Test Org",
        slug: `payroll-${Date.now()}`,
        logo: null,
        createdAt: new Date(),
        metadata: "{}",
      })
      .onConflictDoNothing();
    await authedAdmin();
  }, 60_000);

  it("creates an employee with encrypted bank details", async () => {
    const res = await createEmployee(
      req({
        name: "Ravi Kumar",
        employee_code: "EMP001",
        pay_type: "salary",
        rate: 30000,
        payout_mode: "both",
        bank_account: "50100234567890",
        bank_name: "HDFC Bank",
        bank_ifsc: "hdfc0001234",
        upi_id: "ravi.kumar@okhdfc",
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      employee: { bank_account_masked: string; upi_id_masked: string };
    };
    expect(data.employee.bank_account_masked).toBe("•••• 7890");
    expect(data.employee.upi_id_masked).toBe("r••••@okhdfc");

    const database = getTestDb();
    const [row] = await database
      .select()
      .from(employees)
      .where(eq(employees.employeeCode, "EMP001"));
    expect(row.ratePaise).toBe(3_000_000);
    expect(row.bankAccountEnc).toBeTruthy();
    expect(row.bankAccountEnc).not.toContain("50100234567890");
    expect(row.bankIfsc).toBe("HDFC0001234");
    expect(row.bankName).toBe("HDFC Bank");
    expect(row.upiIdEnc).toBeTruthy();
    expect(row.upiIdEnc).not.toContain("ravi.kumar@okhdfc");
  });

  it("rejects bank payout without IFSC and bad IFSC/UPI formats", async () => {
    const noIfsc = await createEmployee(
      req({
        name: "No Ifsc",
        employee_code: "EMP090",
        pay_type: "salary",
        rate: 20000,
        payout_mode: "bank",
        bank_account: "50100234567890",
      }),
    );
    expect(noIfsc.status).toBe(400);

    const badIfsc = await createEmployee(
      req({
        name: "Bad Ifsc",
        employee_code: "EMP091",
        pay_type: "salary",
        rate: 20000,
        payout_mode: "bank",
        bank_account: "50100234567890",
        bank_ifsc: "NOTANIFSC",
      }),
    );
    expect(badIfsc.status).toBe(400);

    const badUpi = await createEmployee(
      req({
        name: "Bad Upi",
        employee_code: "EMP092",
        pay_type: "hourly",
        rate: 200,
        payout_mode: "upi",
        upi_id: "not-a-vpa",
      }),
    );
    expect(badUpi.status).toBe(400);

    const upiOnly = await createEmployee(
      req({
        name: "Upi Only",
        employee_code: "EMP093",
        pay_type: "hourly",
        rate: 200,
        payout_mode: "upi",
        upi_id: "helper@okpay",
      }),
    );
    expect(upiOnly.status).toBe(201);
  });

  it("verifies payout details via mocked Razorpay (IFSC + VPA)", async () => {
    // Gateway keys only need to be present — HTTP is mocked below.
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_verify");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "verify-secret");
    const created = await createEmployee(
      req({
        name: "Verify Me",
        employee_code: "EMP099",
        pay_type: "salary",
        rate: 25000,
        payout_mode: "both",
        bank_account: "50100234567899",
        bank_name: "HDFC Bank",
        bank_ifsc: "HDFC0001234",
        upi_id: "verify.me@okhdfc",
      }),
    );
    expect(created.status).toBe(201);
    const empId = ((await created.json()) as { employee: { id: string } }).employee.id;

    // NOTE: the Neon HTTP driver also uses global fetch — pass through everything
    // that is not a Razorpay call.
    const realFetch = globalThis.fetch;
    const okFetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith("https://ifsc.razorpay.com/")) {
        return new Response(JSON.stringify({ BANK: "HDFC Bank", BRANCH: "MUMBAI" }), {
          status: 200,
        });
      }
      if (u.includes("api.razorpay.com/v1/payments/validate/vpa")) {
        return new Response(JSON.stringify({ success: true, customer_name: "Verify Me" }), {
          status: 200,
        });
      }
      return realFetch(u, init);
    });
    vi.stubGlobal("fetch", okFetch);
    try {
      const res = await verifyEmployee(req({}), {
        params: Promise.resolve({ id: empId }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        verification_status: string;
        bank: { ok: boolean; detail: string };
        upi: { ok: boolean; detail: string };
      };
      expect(body.verification_status).toBe("verified");
      expect(body.bank.ok).toBe(true);
      expect(body.upi.ok).toBe(true);

      const database = getTestDb();
      const [row] = await database
        .select()
        .from(employees)
        .where(eq(employees.employeeCode, "EMP099"));
      expect(row.verificationStatus).toBe("verified");
      expect(row.bankIfscBank).toBe("HDFC Bank");
      expect(row.bankIfscVerifiedAt).toBeTruthy();
      expect(row.upiHolderName).toBe("Verify Me");
      expect(row.upiVerifiedAt).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("marks verification failed on bad IFSC, unavailable on VPA 4xx", async () => {
    const created = await createEmployee(
      req({
        name: "Bad Details",
        employee_code: "EMP098",
        pay_type: "salary",
        rate: 25000,
        payout_mode: "both",
        bank_account: "50100234567898",
        bank_ifsc: "HDFC0001234",
        upi_id: "bad@okhdfc",
      }),
    );
    const empId = ((await created.json()) as { employee: { id: string } }).employee.id;

    const realFetch2 = globalThis.fetch;
    const badFetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith("https://ifsc.razorpay.com/")) {
        return new Response("Not Found", { status: 404 });
      }
      // UPI-Collect deprecation style response: 4xx => unavailable, not invalid.
      if (u.includes("api.razorpay.com/")) {
        return new Response(JSON.stringify({ error: "gone" }), { status: 410 });
      }
      return realFetch2(u, init);
    });
    vi.stubGlobal("fetch", badFetch);
    try {
      const res = await verifyEmployee(req({}), {
        params: Promise.resolve({ id: empId }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        verification_status: string;
        bank: { ok: boolean };
        upi: { ok: boolean; unavailable: boolean };
      };
      expect(body.bank.ok).toBe(false);
      expect(body.upi.unavailable).toBe(true);
      // Bad IFSC is a hard failure even though UPI is merely unavailable.
      expect(body.verification_status).toBe("failed");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("treats a retired UPI endpoint as unsupported, keeps bank verdict", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_verify");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "verify-secret");
    const created = await createEmployee(
      req({
        name: "Retired Upi",
        employee_code: "EMP097",
        pay_type: "salary",
        rate: 25000,
        payout_mode: "both",
        bank_account: "50100234567897",
        bank_ifsc: "HDFC0001234",
        upi_id: "retired@okhdfc",
      }),
    );
    expect(created.status).toBe(201);
    const empId = ((await created.json()) as { employee: { id: string } }).employee.id;

    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.startsWith("https://ifsc.razorpay.com/")) {
          return new Response(JSON.stringify({ BANK: "HDFC Bank", BRANCH: "MUMBAI" }), {
            status: 200,
          });
        }
        if (u.includes("api.razorpay.com/")) {
          // Razorpay's actual response for the retired UPI-Collect endpoint.
          return new Response(
            JSON.stringify({
              error: {
                code: "BAD_REQUEST_ERROR",
                description: "The requested URL was not found on the server.",
              },
            }),
            { status: 400 },
          );
        }
        return realFetch(u, init);
      }),
    );
    try {
      const res = await verifyEmployee(req({}), {
        params: Promise.resolve({ id: empId }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        verification_status: string;
        bank: { ok: boolean };
        upi: { ok: boolean; unsupported: boolean };
      };
      expect(body.bank.ok).toBe(true);
      expect(body.upi.unsupported).toBe(true);
      // Bank passed and UPI is uncheckable (not wrong) → verified overall.
      expect(body.verification_status).toBe("verified");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects bad pay_type with 400", async () => {
    const res = await createEmployee(req({ name: "X", employee_code: "E2", pay_type: "daily" }));
    expect(res.status).toBe(400);
  });

  it("deducts paid leave balance on approval, blocks overdraft", async () => {
    const database = getTestDb();
    await database.insert(leaveTypes).values({
      id: "lt_cl",
      organizationId: ORG,
      outletId: null,
      name: "Casual",
      isPaid: true,
      yearlyQuota: "12",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });
    const empRes = await createEmployee(
      req({
        name: "Meera",
        employee_code: "EMP010",
        pay_type: "salary",
        rate: 30000,
        payout_mode: "bank",
        bank_account: "50100234567891",
        bank_ifsc: "SBIN0060234",
      }),
    );
    const emp = ((await empRes.json()) as { employee: { id: string } }).employee;

    // 20-day request exceeds the 12-day quota → approval must fail.
    const big = await applyLeave(
      req({
        employee_id: emp.id,
        leave_type_id: "lt_cl",
        start_date: "2026-03-01",
        end_date: "2026-03-20",
      }),
    );
    expect(big.status).toBe(201);
    const bigId = ((await big.json()) as { leave: { id: string } }).leave.id;
    const denied = await approveLeave(req({}), { params: Promise.resolve({ id: bigId }) });
    expect(denied.status).toBe(400);

    // 2-day request approves and deducts 12 → 10.
    const small = await applyLeave(
      req({
        employee_id: emp.id,
        leave_type_id: "lt_cl",
        start_date: "2026-03-01",
        end_date: "2026-03-02",
      }),
    );
    const smallId = ((await small.json()) as { leave: { id: string } }).leave.id;
    const ok = await approveLeave(req({}), { params: Promise.resolve({ id: smallId }) });
    expect(ok.status).toBe(200);
    const [bal] = await database.select().from(leaveBalances);
    expect(Number(bal.used)).toBe(2);
    expect(Number(bal.remaining)).toBe(10);

    // Replay is idempotent.
    const replay = await approveLeave(req({}), { params: Promise.resolve({ id: smallId }) });
    expect(replay.status).toBe(409);
  }, 60_000);

  it("runs payroll end-to-end: compute, incentive, approve lock", async () => {
    const database = getTestDb();
    await database.insert(leaveTypes).values({
      id: "lt_unpaid",
      organizationId: ORG,
      outletId: null,
      name: "Unpaid",
      isPaid: false,
      yearlyQuota: "0",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });
    const empRes = await createEmployee(
      req({
        name: "Arjun",
        employee_code: "EMP020",
        pay_type: "salary",
        rate: 30000,
        payout_mode: "upi",
        upi_id: "arjun@okicici",
      }),
    );
    const emp = ((await empRes.json()) as { employee: { id: string } }).employee;

    // 1 unpaid day inside the period.
    const leave = await applyLeave(
      req({
        employee_id: emp.id,
        leave_type_id: "lt_unpaid",
        start_date: "2026-04-05",
        end_date: "2026-04-05",
      }),
    );
    const leaveId = ((await leave.json()) as { leave: { id: string } }).leave.id;
    const { POST: approveLeaveRoute } = await import("@/app/api/payroll/leaves/[id]/approve/route");
    const approved = await approveLeaveRoute(req({}), { params: Promise.resolve({ id: leaveId }) });
    expect(approved.status).toBe(200);

    const periodRes = await createPeriod(req({ start_date: "2026-04-01", end_date: "2026-04-30" }));
    expect(periodRes.status).toBe(201);
    const period = ((await periodRes.json()) as { period: { id: string } }).period;

    const runRes = await createRun(req({ pay_period_id: period.id }));
    expect(runRes.status).toBe(201);
    const { runId } = (await runRes.json()) as { runId: string };

    // Unpaid day deducted: daily = round(3_000_000/30) = 100000.
    const detail = await runDetail({} as never, { params: Promise.resolve({ id: runId }) });
    const body = (await detail.json()) as {
      items: { id: string; unpaidLeavePaise: number; netPayPaise: number }[];
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].unpaidLeavePaise).toBe(100000);

    // Incentive bumps gross + net.
    const before = body.items[0].netPayPaise;
    const incRes = await addIncentive(
      req({ payroll_item_id: body.items[0].id, name: "Bonus", amount: 2000 }),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(incRes.status).toBe(201);
    const after = (
      (await (await runDetail({} as never, { params: Promise.resolve({ id: runId }) })).json()) as {
        items: { netPayPaise: number }[];
      }
    ).items[0];
    expect(after.netPayPaise).toBe(before + 200000);

    // Approve locks; further mutation 409s.
    const locked = await approveRun({} as never, { params: Promise.resolve({ id: runId }) });
    expect(locked.status).toBe(200);
    const again = await approveRun({} as never, { params: Promise.resolve({ id: runId }) });
    expect(again.status).toBe(409);
    const blocked = await addIncentive(
      req({ payroll_item_id: body.items[0].id, name: "Late", amount: 100 }),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(blocked.status).toBe(409);

    // Run-level totals persisted.
    const [run] = await database.select().from(payrollRuns).where(eq(payrollRuns.id, runId));
    expect(run.status).toBe("approved");
    const [item] = await database
      .select()
      .from(payrollItems)
      .where(eq(payrollItems.payrollRunId, runId));
    expect(item.netPayPaise).toBe(run.totalNetPaise);
  }, 90_000);

  it("rejects bad attendance records", async () => {
    const future = await markAttendance(
      req({ days: [{ employee_id: "x", date: "2999-01-01", status: "present" }] }),
    );
    expect(future.status).toBe(400);
    const badStatus = await markAttendance(
      req({ days: [{ employee_id: "x", date: "2026-04-01", status: "sleeping" }] }),
    );
    expect(badStatus.status).toBe(400);
    const badHours = await markAttendance(
      req({ days: [{ employee_id: "x", date: "2026-04-01", status: "present", hours: 99 }] }),
    );
    expect(badHours.status).toBe(400);
  });

  it("feeds attendance into payroll: absent deducts, hourly hours pay", async () => {
    const mkEmp = async (code: string, pay_type: string, rate: number, payout: object) => {
      const res = await createEmployee(
        req({ name: code, employee_code: code, pay_type, rate, ...payout }),
      );
      expect(res.status).toBe(201);
      return ((await res.json()) as { employee: { id: string } }).employee.id;
    };
    const salId = await mkEmp("ATT_SAL", "salary", 30000, {
      payout_mode: "bank",
      bank_account: "50100234567890",
      bank_ifsc: "HDFC0001234",
    });
    const hrId = await mkEmp("ATT_HR", "hourly", 200, {
      payout_mode: "upi",
      upi_id: "att.hr@okpay",
    });

    const marked = await markAttendance(
      req({
        days: [
          { employee_id: salId, date: "2026-04-02", status: "absent" },
          { employee_id: salId, date: "2026-04-03", status: "absent" },
          { employee_id: salId, date: "2026-04-04", status: "half_day", hours: 4 },
          { employee_id: hrId, date: "2026-04-02", status: "present", hours: 8 },
          { employee_id: hrId, date: "2026-04-03", status: "present", hours: 8 },
        ],
      }),
    );
    expect(marked.status).toBe(201);

    const listed = await listAttendance({ url: "http://test.local/api/x?month=2026-04" } as never);
    const listedBody = (await listed.json()) as { days: unknown[] };
    expect(listed.status).toBe(200);
    expect(listedBody.days).toHaveLength(5);

    const periodRes = await createPeriod(req({ start_date: "2026-04-01", end_date: "2026-04-30" }));
    expect(periodRes.status).toBe(201);
    const period = ((await periodRes.json()) as { period: { id: string } }).period;

    const runRes = await createRun(req({ pay_period_id: period.id }));
    expect(runRes.status).toBe(201);
    const runBody = (await runRes.json()) as { runId: string; unmarkedDays: number };
    // sal: 30−3 marked = 27 unmarked; hr: 30−2 = 28 → 55 assumed present.
    expect(runBody.unmarkedDays).toBe(55);

    const detail = await runDetail({} as never, { params: Promise.resolve({ id: runBody.runId }) });
    const body = (await detail.json()) as {
      items: { id: string; unpaidLeavePaise: number; grossPayPaise: number; netPayPaise: number }[];
    };
    expect(body.items).toHaveLength(2);

    // Salary: 2 absent + 0.5 half = 2.5 unpaid days × daily 100000.
    const salItem = body.items.find((i) => i.unpaidLeavePaise === 250000);
    expect(salItem).toBeDefined();
    // Hourly: 16h × 200 = 320000 paise gross, no unpaid.
    const hrItem = body.items.find((i) => i.grossPayPaise === 320000);
    expect(hrItem).toBeDefined();
    expect(hrItem!.unpaidLeavePaise).toBe(0);
  }, 90_000);
});
