import { queryOptions } from "@tanstack/react-query";
import {
  getEmployees,
  getHolidays,
  getHolidayRule,
  getLeaveBalances,
  getLeaveRequests,
  getLeaveTypes,
  getMyBalances,
  getMyLeaves,
  getMyPayslips,
  getMyProfile,
  getPayPeriods,
  getPayrollRun,
  getPayrollRuns,
} from "./service";

export const payrollKeys = {
  all: ["payroll"] as const,
  employees: () => [...payrollKeys.all, "employees"] as const,
  leaveTypes: () => [...payrollKeys.all, "leave-types"] as const,
  balances: (employeeId?: string, year?: number) =>
    [...payrollKeys.all, "balances", employeeId ?? "all", year ?? "current"] as const,
  leaves: (filters?: { employee_id?: string; status?: string }) =>
    [...payrollKeys.all, "leaves", filters ?? {}] as const,
  holidays: (year?: number) => [...payrollKeys.all, "holidays", year ?? "all"] as const,
  holidayRule: () => [...payrollKeys.all, "holiday-rule"] as const,
  periods: () => [...payrollKeys.all, "periods"] as const,
  runs: () => [...payrollKeys.all, "runs"] as const,
  run: (id: string) => [...payrollKeys.all, "run", id] as const,
  me: () => [...payrollKeys.all, "me"] as const,
  myBalances: (year?: number) => [...payrollKeys.all, "me", "balances", year ?? "current"] as const,
  myLeaves: () => [...payrollKeys.all, "me", "leaves"] as const,
  myPayslips: () => [...payrollKeys.all, "me", "payslips"] as const,
};

export const employeesQueryOptions = queryOptions({
  queryKey: payrollKeys.employees(),
  queryFn: getEmployees,
});

export const leaveTypesQueryOptions = queryOptions({
  queryKey: payrollKeys.leaveTypes(),
  queryFn: getLeaveTypes,
});

export const leaveBalancesQueryOptions = (employeeId?: string, year?: number) =>
  queryOptions({
    queryKey: payrollKeys.balances(employeeId, year),
    queryFn: () => getLeaveBalances(employeeId, year),
  });

export const leaveRequestsQueryOptions = (filters?: { employee_id?: string; status?: string }) =>
  queryOptions({
    queryKey: payrollKeys.leaves(filters),
    queryFn: () => getLeaveRequests(filters),
  });

export const holidaysQueryOptions = (year?: number) =>
  queryOptions({
    queryKey: payrollKeys.holidays(year),
    queryFn: () => getHolidays(year),
  });

export const holidayRuleQueryOptions = queryOptions({
  queryKey: payrollKeys.holidayRule(),
  queryFn: getHolidayRule,
});

export const payPeriodsQueryOptions = queryOptions({
  queryKey: payrollKeys.periods(),
  queryFn: getPayPeriods,
});

export const payrollRunsQueryOptions = queryOptions({
  queryKey: payrollKeys.runs(),
  queryFn: getPayrollRuns,
});

export const payrollRunQueryOptions = (id: string) =>
  queryOptions({
    queryKey: payrollKeys.run(id),
    queryFn: () => getPayrollRun(id),
  });

export const myProfileQueryOptions = queryOptions({
  queryKey: payrollKeys.me(),
  queryFn: getMyProfile,
});

export const myBalancesQueryOptions = (year?: number) =>
  queryOptions({
    queryKey: payrollKeys.myBalances(year),
    queryFn: () => getMyBalances(year),
  });

export const myLeavesQueryOptions = queryOptions({
  queryKey: payrollKeys.myLeaves(),
  queryFn: getMyLeaves,
});

export const myPayslipsQueryOptions = queryOptions({
  queryKey: payrollKeys.myPayslips(),
  queryFn: getMyPayslips,
});
