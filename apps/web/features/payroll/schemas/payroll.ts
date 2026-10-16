import * as z from "zod";

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

export const employeeBase = {
  name: z.string().trim().min(2, "Name min 2 chars").max(100),
  email: z.string().trim().email("Valid email required").optional().or(z.literal("")),
  employee_code: z.string().trim().min(1, "Code required").max(20),
  pay_type: z.enum(["hourly", "salary"]),
  rate: z.number({ error: "Rate required" }).min(0, "Rate can't be negative"),
  currency: z.string().trim().max(8).optional().or(z.literal("")),
  payout_mode: z.enum(["bank", "upi", "both"]),
  bank_account: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "9–18 digit account number")
    .optional()
    .or(z.literal("")),
  bank_name: z.string().trim().max(100).optional().or(z.literal("")),
  bank_ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC_RE, "IFSC like HDFC0001234")
    .optional()
    .or(z.literal("")),
  upi_id: z.string().trim().regex(UPI_RE, "UPI ID like name@okhdfc").optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  outlet_id: z.string().optional().or(z.literal("")),
  joining_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
};

function payoutIssue(ctx: z.RefinementCtx, payoutMode: string): void {
  ctx.addIssue({
    code: "custom",
    message:
      payoutMode === "upi"
        ? "UPI ID required for UPI payouts"
        : "Account number + IFSC required for bank payouts",
    path: [payoutMode === "upi" ? "upi_id" : "bank_ifsc"],
  });
}

export const employeeSchema = z.object(employeeBase).superRefine((v, ctx) => {
  const bankTouched = !!v.bank_account || !!v.bank_ifsc || !!v.bank_name;
  // All-empty is invalid on create — server enforces the same.
  if (!bankTouched && !v.upi_id) {
    payoutIssue(ctx, v.payout_mode);
    return;
  }
  const ok =
    v.payout_mode === "bank"
      ? !!v.bank_account && !!v.bank_ifsc
      : v.payout_mode === "upi"
        ? !!v.upi_id
        : !!v.upi_id || (!!v.bank_account && !!v.bank_ifsc);
  if (!ok) payoutIssue(ctx, v.payout_mode);
});

/**
 * Edit-mode schema: blank encrypted fields mean "keep what's on file".
 * `hasBankOnFile` / `hasUpiOnFile` come from the masked values already stored.
 * Newly typed values must still be complete (account+IFSC together).
 */
export function employeeEditSchema(hasBankOnFile: boolean, hasUpiOnFile: boolean) {
  return z.object(employeeBase).superRefine((v, ctx) => {
    // Complete new bank details, or keep-existing (blank account + on file).
    const bankSatisfied = (!!v.bank_account && !!v.bank_ifsc) || (!v.bank_account && hasBankOnFile);
    const upiSatisfied = !!v.upi_id || (!v.upi_id && hasUpiOnFile);
    const ok =
      v.payout_mode === "bank"
        ? bankSatisfied
        : v.payout_mode === "upi"
          ? upiSatisfied
          : bankSatisfied || upiSatisfied;
    if (!ok) payoutIssue(ctx, v.payout_mode);
  });
}

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export const leaveTypeSchema = z.object({
  name: z.string().trim().min(2, "Name min 2 chars").max(60),
  is_paid: z.boolean(),
  yearly_quota: z.number({ error: "Quota required" }).min(0, "Quota can't be negative").max(365),
});

export type LeaveTypeFormValues = z.infer<typeof leaveTypeSchema>;

export const leaveApplySchema = z
  .object({
    employee_id: z.string().min(1, "Employee required"),
    leave_type_id: z.string().min(1, "Leave type required"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
      .optional()
      .or(z.literal("")),
    day_type: z.enum(["full", "first_half", "second_half"]),
    reason: z.string().max(500).optional().or(z.literal("")),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    message: "End date can't be before start date",
    path: ["end_date"],
  })
  .refine((v) => v.day_type === "full" || !v.end_date || v.end_date === v.start_date, {
    message: "Half-day applies to single-day leave only",
    path: ["day_type"],
  });

export type LeaveApplyValues = z.infer<typeof leaveApplySchema>;

export const holidaySchema = z.object({
  name: z.string().trim().min(2, "Name min 2 chars").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  is_optional: z.boolean(),
});

export type HolidayFormValues = z.infer<typeof holidaySchema>;

export const holidayRuleSchema = z.object({
  multiplier: z.number({ error: "Multiplier required" }).min(1, "At least 1×").max(5),
  fixed_incentive_amount: z.number().min(0).optional().or(z.literal("")),
});

export type HolidayRuleValues = z.infer<typeof holidayRuleSchema>;

export const payPeriodSchema = z
  .object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "End date can't be before start date",
    path: ["end_date"],
  });

export type PayPeriodValues = z.infer<typeof payPeriodSchema>;

export const incentiveSchema = z.object({
  payroll_item_id: z.string().min(1),
  name: z.string().trim().min(2, "Name min 2 chars").max(80),
  amount: z.number({ error: "Amount required" }).min(0, "Amount can't be negative"),
  note: z.string().max(200).optional().or(z.literal("")),
});

export type IncentiveFormValues = z.infer<typeof incentiveSchema>;
