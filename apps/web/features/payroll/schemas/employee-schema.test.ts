import { describe, expect, it } from "vitest";
import { employeeEditSchema, employeeSchema } from "./payroll";

const base = {
  name: "Ravi",
  email: "",
  employee_code: "E1",
  pay_type: "salary",
  rate: 30000,
  currency: "INR",
  status: "active",
  outlet_id: "",
  joining_date: "",
} as const;

describe("edit schema keep-existing", () => {
  it("passes with prefilled IFSC/name + blank account when bank on file", () => {
    const r = employeeEditSchema(true, false).safeParse({
      ...base,
      payout_mode: "bank",
      bank_account: "",
      bank_name: "HDFC Bank",
      bank_ifsc: "HDFC0001234",
      upi_id: "",
    });
    expect(r.success).toBe(true);
  });
  it("fails bank mode with no bank on file and blank account", () => {
    const r = employeeEditSchema(false, false).safeParse({
      ...base,
      payout_mode: "bank",
      bank_account: "",
      bank_name: "",
      bank_ifsc: "",
      upi_id: "",
    });
    expect(r.success).toBe(false);
  });
  it("fails a half-typed new account (account without IFSC)", () => {
    const r = employeeEditSchema(true, false).safeParse({
      ...base,
      payout_mode: "bank",
      bank_account: "50100234567890",
      bank_name: "",
      bank_ifsc: "",
      upi_id: "",
    });
    expect(r.success).toBe(false);
  });
  it("create schema rejects all-empty payout", () => {
    const r = employeeSchema.safeParse({
      ...base,
      payout_mode: "bank",
      bank_account: "",
      bank_name: "",
      bank_ifsc: "",
      upi_id: "",
    });
    expect(r.success).toBe(false);
  });
});
