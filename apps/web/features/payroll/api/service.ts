import { paiseToRupees, type Employee, type LeaveRequest, type PayrollItem } from "./types";

const n = (v: unknown, fb = 0): number => {
  const x = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(x) ? x : fb;
};
const r = (paise: unknown): number => paiseToRupees(n(paise));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "include" });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

/* ------------------------------ employees ------------------------------ */

export interface EmployeeRow extends Record<string, unknown> {
  bank_account_masked: string;
}

export async function getEmployees(): Promise<Employee[]> {
  const data = await api<{ employees: Record<string, unknown>[] }>("/api/payroll/employees");
  return data.employees.map((e) => ({
    id: String(e.id),
    outlet_id: (e.outlet_id as string) ?? null,
    name: String(e.name),
    email: (e.email as string) ?? null,
    employee_code: String(e.employee_code),
    pay_type: e.pay_type as Employee["pay_type"],
    rate: r(e.ratePaise ?? e.rate_paise),
    currency: String(e.currency ?? "INR"),
    bank_account_masked: String(e.bank_account_masked ?? "—"),
    bank_name: (e.bankName ?? e.bank_name ?? null) as string | null,
    bank_ifsc: (e.bankIfsc ?? e.bank_ifsc ?? null) as string | null,
    upi_id_masked: String(e.upi_id_masked ?? "—"),
    verification_status: (e.verificationStatus ??
      e.verification_status ??
      "unverified") as Employee["verification_status"],
    status: e.status as Employee["status"],
    joining_date: (e.joiningDate ?? e.joining_date ?? null) as string | null,
  }));
}

export async function createEmployee(payload: import("./types").EmployeePayload): Promise<void> {
  await api("/api/payroll/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateEmployee(
  id: string,
  payload: Partial<import("./types").EmployeePayload>,
): Promise<void> {
  await api(`/api/payroll/employees?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export interface PayoutVerification {
  verification_status: "unverified" | "pending" | "verified" | "failed" | "unavailable";
  bank: { checked: boolean; ok: boolean; unavailable: boolean; detail: string };
  upi: { checked: boolean; ok: boolean; unavailable: boolean; detail: string };
}

/** Background verification of an employee's bank/UPI details. Advisory only. */
export async function verifyEmployee(id: string): Promise<PayoutVerification> {
  return api<PayoutVerification>(`/api/payroll/employees/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

/* ------------------------------ leave types ------------------------------ */

export async function getLeaveTypes(): Promise<import("./types").LeaveType[]> {
  const data = await api<{ leave_types: Record<string, unknown>[] }>("/api/payroll/leave-types");
  return data.leave_types.map((t) => ({
    id: String(t.id),
    name: String(t.name),
    is_paid: (t.isPaid ?? t.is_paid) ? true : false,
    yearly_quota: n(t.yearlyQuota ?? t.yearly_quota),
    is_active: (t.isActive ?? t.is_active) !== false,
  }));
}

export async function createLeaveType(payload: {
  name: string;
  is_paid?: boolean;
  yearly_quota: number;
}): Promise<void> {
  await api("/api/payroll/leave-types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ------------------------------ balances & requests ------------------------------ */

export async function getLeaveBalances(
  employeeId?: string,
  year?: number,
): Promise<import("./types").LeaveBalance[]> {
  const q = new URLSearchParams();
  if (employeeId) q.set("employee_id", employeeId);
  if (year) q.set("year", String(year));
  const data = await api<{ balances: Record<string, unknown>[] }>(
    `/api/payroll/leave-balances?${q}`,
  );
  return data.balances.map((b) => ({
    id: String(b.id),
    employee_id: String(b.employeeId ?? b.employee_id),
    employee_name: (b.employeeName ?? b.employee_name ?? undefined) as string | undefined,
    leave_type_id: String(b.leaveTypeId ?? b.leave_type_id),
    leave_type_name: (b.leaveTypeName ?? b.leave_type_name ?? undefined) as string | undefined,
    is_paid: (b.isPaid ?? b.is_paid ?? undefined) as boolean | undefined,
    year: n(b.year),
    opening_balance: n(b.openingBalance ?? b.opening_balance),
    used: n(b.used),
    remaining: n(b.remaining),
  }));
}

export async function getLeaveRequests(filters?: {
  employee_id?: string;
  status?: string;
}): Promise<LeaveRequest[]> {
  const q = new URLSearchParams();
  if (filters?.employee_id) q.set("employee_id", filters.employee_id);
  if (filters?.status) q.set("status", filters.status);
  const data = await api<{ leaves: Record<string, unknown>[] }>(`/api/payroll/leaves?${q}`);
  return data.leaves.map((l) => ({
    id: String(l.id),
    employee_id: String(l.employeeId ?? l.employee_id),
    employee_name: (l.employeeName ?? l.employee_name ?? undefined) as string | undefined,
    leave_type_id: String(l.leaveTypeId ?? l.leave_type_id),
    leave_type_name: (l.leaveTypeName ?? l.leave_type_name ?? undefined) as string | undefined,
    start_date: String(l.startDate ?? l.start_date),
    end_date: String(l.endDate ?? l.end_date),
    total_days: n(l.totalDays ?? l.total_days),
    day_type: (l.dayType ?? l.day_type ?? "full") as LeaveRequest["day_type"],
    reason: (l.reason ?? null) as string | null,
    status: l.status as LeaveRequest["status"],
    approved_by: (l.approvedBy ?? l.approved_by ?? undefined) as string | undefined,
    approved_at: (l.approvedAt ?? l.approved_at ?? undefined) as string | undefined,
    remarks: (l.remarks ?? undefined) as string | undefined,
  }));
}

export async function applyLeave(payload: {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date?: string;
  day_type?: string;
  reason?: string;
}): Promise<void> {
  await api("/api/payroll/leaves", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function decideLeave(
  id: string,
  action: "approve" | "reject",
  remarks?: string,
): Promise<void> {
  await api(`/api/payroll/leaves/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ remarks }),
  });
}

/* ------------------------------ holidays ------------------------------ */

export async function getHolidays(year?: number): Promise<import("./types").PublicHoliday[]> {
  const q = year ? `?year=${year}` : "";
  const data = await api<{ holidays: Record<string, unknown>[] }>(`/api/payroll/holidays${q}`);
  return data.holidays.map((h) => ({
    id: String(h.id),
    name: String(h.name),
    date: String(h.date),
    is_optional: (h.isOptional ?? h.is_optional) === true,
  }));
}

export async function createHoliday(payload: {
  name: string;
  date: string;
  is_optional?: boolean;
}): Promise<void> {
  await api("/api/payroll/holidays", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteHoliday(id: string): Promise<void> {
  await api(`/api/payroll/holidays?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getHolidayRule(): Promise<import("./types").HolidayRule | null> {
  const data = await api<{ rule: Record<string, unknown> | null }>("/api/payroll/holiday-rules");
  if (!data.rule) return null;
  return {
    id: String(data.rule.id),
    multiplier: Number(data.rule.multiplier ?? 1.5),
    fixed_incentive_amount: r(
      data.rule.fixedIncentivePaise ?? data.rule.fixed_incentive_paise ?? 0,
    ),
  };
}

export async function saveHolidayRule(payload: {
  multiplier: number;
  fixed_incentive_amount?: number;
}): Promise<void> {
  await api("/api/payroll/holiday-rules", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ------------------------------ periods & runs ------------------------------ */

export async function getPayPeriods(): Promise<import("./types").PayPeriod[]> {
  const data = await api<{ periods: Record<string, unknown>[] }>("/api/payroll/periods");
  return data.periods.map((p) => ({
    id: String(p.id),
    start_date: String(p.startDate ?? p.start_date),
    end_date: String(p.endDate ?? p.end_date),
    status: (p.status ?? "open") as "open" | "locked",
  }));
}

export async function createPayPeriod(start_date: string, end_date: string): Promise<void> {
  await api("/api/payroll/periods", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ start_date, end_date }),
  });
}

export async function getPayrollRuns(): Promise<import("./types").PayrollRunSummary[]> {
  const data = await api<{ runs: Record<string, unknown>[] }>("/api/payroll/runs");
  return data.runs.map((x) => ({
    id: String(x.id),
    pay_period_id: String(x.payPeriodId ?? x.pay_period_id),
    status: (x.status ?? "draft") as "draft" | "approved",
    total_gross: r(x.totalGrossPaise ?? x.total_gross_paise),
    total_net: r(x.totalNetPaise ?? x.total_net_paise),
    created_by: (x.createdBy ?? x.created_by ?? undefined) as string | undefined,
    approved_at: (x.approvedAt ?? x.approved_at ?? undefined) as string | undefined,
  }));
}

export async function createPayrollRun(
  pay_period_id: string,
  inputs?: import("./types").RunUnitInput[],
): Promise<{ runId: string; itemCount: number }> {
  return api("/api/payroll/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pay_period_id, inputs }),
  });
}

export async function addIncentive(
  runId: string,
  input: { payroll_item_id: string; name: string; amount: number; note?: string },
): Promise<void> {
  await api(`/api/payroll/runs/${encodeURIComponent(runId)}/incentives`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function approveRun(runId: string): Promise<void> {
  await api(`/api/payroll/runs/${encodeURIComponent(runId)}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function overrideItem(
  runId: string,
  itemId: string,
  input: { deductions?: number; notes?: string; reason?: string },
): Promise<void> {
  await api(`/api/payroll/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deductions: input.deductions, notes: input.notes ?? input.reason }),
  });
}

export async function getPayrollRun(id: string): Promise<{
  run: import("./types").PayrollRunSummary & { pay_period?: unknown };
  items: PayrollItem[];
}> {
  const data = await api<{
    run: Record<string, unknown>;
    items: Record<string, unknown>[];
  }>(`/api/payroll/runs/${encodeURIComponent(id)}`);
  const toItem = (x: Record<string, unknown>): PayrollItem => ({
    id: String(x.id),
    employee_id: String(x.employeeId ?? x.employee_id),
    employee_name: (x.employee_name ?? undefined) as string | undefined,
    employee_code: (x.employee_code ?? undefined) as string | undefined,
    working_units: n(x.workingUnits ?? x.working_units),
    holiday_units: n(x.holidayUnits ?? x.holiday_units),
    gross_wage: r(x.grossWagePaise ?? x.gross_wage_paise),
    holiday_extra: r(x.holidayExtraPaise ?? x.holiday_extra_paise),
    total_incentives: r(x.totalIncentivesPaise ?? x.total_incentives_paise),
    unpaid_leave_deduction: r(x.unpaidLeavePaise ?? x.unpaid_leave_paise),
    gross_pay: r(x.grossPayPaise ?? x.gross_pay_paise),
    deductions: r(x.deductionsPaise ?? x.deductions_paise),
    net_pay: r(x.netPayPaise ?? x.net_pay_paise),
    notes: (x.notes ?? undefined) as string | undefined,
    incentives: ((x.incentives ?? []) as Record<string, unknown>[]).map((i) => ({
      id: String(i.id),
      name: String(i.name),
      amount: r(i.amountPaise ?? i.amount_paise),
      note: (i.note ?? null) as string | null,
    })),
  });
  return {
    run: {
      id: String(data.run.id),
      pay_period_id: String(data.run.payPeriodId ?? data.run.pay_period_id),
      status: (data.run.status ?? "draft") as "draft" | "approved",
      total_gross: r(data.run.totalGrossPaise ?? data.run.total_gross_paise),
      total_net: r(data.run.totalNetPaise ?? data.run.total_net_paise),
    },
    items: data.items.map(toItem),
  };
}

export async function addRunIncentive(
  runId: string,
  payload: { payroll_item_id: string; name: string; amount: number; note?: string },
): Promise<void> {
  await api(`/api/payroll/runs/${encodeURIComponent(runId)}/incentives`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function overrideRunItem(
  runId: string,
  itemId: string,
  payload: Record<string, number | string | undefined>,
): Promise<void> {
  await api(`/api/payroll/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function approvePayrollRun(runId: string): Promise<void> {
  await api(`/api/payroll/runs/${encodeURIComponent(runId)}/approve`, { method: "POST" });
}

/* ------------------------------ self service ------------------------------ */

export async function getMyProfile(): Promise<{ employee: Employee | null; can_manage: boolean }> {
  const data = await api<{ employee: Record<string, unknown> | null; can_manage?: unknown }>(
    "/api/payroll/me",
  );
  if (!data.employee) return { employee: null, can_manage: data.can_manage === true };
  const e = data.employee;
  return {
    can_manage: data.can_manage === true,
    employee: {
      id: String(e.id),
      outlet_id: (e.outlet_id as string) ?? null,
      name: String(e.name),
      email: (e.email as string) ?? null,
      employee_code: String(e.employee_code),
      pay_type: e.pay_type as Employee["pay_type"],
      rate: r((e as Record<string, unknown>).ratePaise ?? e.rate_paise),
      currency: String(e.currency ?? "INR"),
      bank_account_masked: String(e.bank_account_masked ?? "—"),
      bank_name: ((e as Record<string, unknown>).bankName ?? e.bank_name ?? null) as string | null,
      bank_ifsc: ((e as Record<string, unknown>).bankIfsc ?? e.bank_ifsc ?? null) as string | null,
      upi_id_masked: String(e.upi_id_masked ?? "—"),
      verification_status: ((e as Record<string, unknown>).verificationStatus ??
        e.verification_status ??
        "unverified") as Employee["verification_status"],
      status: e.status as Employee["status"],
      joining_date: ((e as Record<string, unknown>).joiningDate ?? e.joining_date ?? null) as
        | string
        | null,
    },
  };
}

export async function getMyBalances(year?: number): Promise<import("./types").LeaveBalance[]> {
  const q = year ? `?view=balances&year=${year}` : "?view=balances";
  const data = await api<{ balances: Record<string, unknown>[] }>(`/api/payroll/me${q}`);
  return data.balances.map((b) => ({
    id: String(b.id ?? `${b.leaveTypeId ?? b.leave_type_id}`),
    employee_id: "",
    leave_type_id: String(b.leaveTypeId ?? b.leave_type_id),
    leave_type_name: String(b.leaveTypeName ?? b.leave_type_name ?? ""),
    is_paid: (b.isPaid ?? b.is_paid ?? undefined) as boolean | undefined,
    year: n(b.year),
    opening_balance: n(b.openingBalance ?? b.opening_balance),
    used: n(b.used),
    remaining: n(b.remaining),
  }));
}

export async function getMyLeaves(): Promise<LeaveRequest[]> {
  const data = await api<{ leaves: Record<string, unknown>[] }>("/api/payroll/me?view=leaves");
  return data.leaves.map((l) => ({
    id: String(l.id),
    employee_id: "",
    leave_type_id: "",
    leave_type_name: String(l.leaveTypeName ?? l.leave_type_name ?? ""),
    start_date: String(l.startDate ?? l.start_date),
    end_date: String(l.endDate ?? l.end_date),
    total_days: n(l.totalDays ?? l.total_days),
    day_type: (l.dayType ?? l.day_type ?? "full") as LeaveRequest["day_type"],
    reason: (l.reason ?? null) as string | null,
    status: l.status as LeaveRequest["status"],
  }));
}

export async function getMyPayslips(): Promise<PayrollItem[]> {
  const data = await api<{ payslips: Record<string, unknown>[] }>("/api/payroll/me?view=payslips");
  return data.payslips.map((x) => ({
    id: String(x.id),
    employee_id: "",
    working_units: n(x.workingUnits ?? x.working_units),
    holiday_units: n(x.holidayUnits ?? x.holiday_units),
    gross_wage: r(x.grossWagePaise ?? x.gross_wage_paise),
    holiday_extra: r(x.holidayExtraPaise ?? x.holiday_extra_paise),
    total_incentives: r(x.totalIncentivesPaise ?? x.total_incentives_paise),
    unpaid_leave_deduction: r(x.unpaidLeavePaise ?? x.unpaid_leave_paise),
    gross_pay: r(x.grossPayPaise ?? x.gross_pay_paise),
    deductions: r(x.deductionsPaise ?? x.deductions_paise),
    net_pay: r(x.netPayPaise ?? x.net_pay_paise),
    incentives: [],
    payroll_run_id: String(x.payrollRunId ?? x.payroll_run_id ?? ""),
    pay_period_id: String(x.pay_period_id ?? ""),
    run_status: String(x.run_status ?? ""),
  }));
}
