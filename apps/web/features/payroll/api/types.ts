export type PayType = "hourly" | "salary";
export type EmployeeStatus = "active" | "inactive";
export type DayType = "full" | "first_half" | "second_half";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Employee {
  id: string;
  outlet_id: string | null;
  name: string;
  email: string | null;
  employee_code: string;
  pay_type: PayType;
  /** Monthly salary (salary) or hourly rate (hourly), in rupees. */
  rate: number;
  currency: string;
  bank_account_masked: string;
  bank_name: string | null;
  bank_ifsc: string | null;
  upi_id_masked: string;
  verification_status: "unverified" | "pending" | "verified" | "failed" | "unavailable";
  status: EmployeeStatus;
  joining_date: string | null;
}

export interface EmployeePayload {
  name: string;
  email?: string;
  employee_code: string;
  pay_type: PayType;
  rate: number;
  currency?: string;
  payout_mode?: "bank" | "upi" | "both";
  bank_account?: string;
  bank_name?: string;
  bank_ifsc?: string;
  upi_id?: string;
  status?: EmployeeStatus;
  outlet_id?: string;
  joining_date?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  is_paid: boolean;
  yearly_quota: number;
  is_active: boolean;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type_id: string;
  leave_type_name?: string;
  is_paid?: boolean;
  year: number;
  opening_balance: number;
  used: number;
  remaining: number;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type_id: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  day_type: DayType;
  reason: string | null;
  status: LeaveStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  remarks?: string | null;
}

export interface PublicHoliday {
  id: string;
  name: string;
  date: string;
  is_optional: boolean;
}

export interface HolidayRule {
  id: string;
  multiplier: number;
  fixed_incentive_amount: number;
}

export interface PayPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: "open" | "locked";
}

export interface PayrollRunSummary {
  id: string;
  pay_period_id: string;
  status: "draft" | "approved";
  total_gross: number;
  total_net: number;
  created_by?: string | null;
  approved_at?: string | null;
}

export interface PayrollIncentive {
  id: string;
  name: string;
  amount: number;
  note: string | null;
}

export interface PayrollItem {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  working_units: number;
  holiday_units: number;
  gross_wage: number;
  holiday_extra: number;
  total_incentives: number;
  unpaid_leave_deduction: number;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  notes?: string | null;
  incentives: PayrollIncentive[];
  /** Self-service context (from /api/payroll/me?view=payslips). */
  payroll_run_id?: string;
  pay_period_id?: string;
  run_status?: string;
}

export interface RunUnitInput {
  employee_id: string;
  working_units?: number;
  holiday_units?: number;
}

export type AttendanceStatus = "present" | "absent" | "half_day" | "weekly_off" | "holiday";

export interface AttendanceDay {
  id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  /** Hours worked that day (hourly staff / overtime). */
  hours: number;
  notes: string | null;
}

export interface AttendanceMark {
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  hours?: number;
  notes?: string;
}

/** API money is rupees (decimal); server stores paise. */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}
