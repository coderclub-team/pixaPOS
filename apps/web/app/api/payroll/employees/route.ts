import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, employees } from "@pixa/db";
import { ulid } from "@pixa/contracts";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { encryptBankAccount, maskBankAccount, decryptBankAccount } from "@/lib/bank-crypto";
import { IFSC_RE, UPI_RE } from "@/features/payroll/schemas/payroll";
import { toPaise } from "@/features/payroll/api/server";

export const dynamic = "force-dynamic";

function serialize(e: typeof employees.$inferSelect) {
  const { bankAccountEnc: _enc, upiIdEnc: _upi, ...rest } = e;
  void _enc;
  void _upi;
  return rest;
}

function maskUpi(v: string | null): string {
  if (!v) return "—";
  const [user, domain] = v.split("@");
  if (!domain) return "••••";
  const head =
    user.length <= 2
      ? "•".repeat(user.length)
      : `${user[0]}${"•".repeat(Math.min(user.length - 1, 4))}`;
  return `${head}@${domain}`;
}

async function maskedSecrets(enc: string | null, upiEnc: string | null) {
  const bank = await maskedBank(enc);
  let upi = "—";
  if (upiEnc) {
    try {
      upi = maskUpi(await decryptBankAccount(upiEnc));
    } catch {
      upi = "•••• (unreadable)";
    }
  }
  return { bank_account_masked: bank, upi_id_masked: upi };
}

function payoutError(body: Record<string, unknown>): string | null {
  const mode = String(body.payout_mode ?? "bank");
  const acct = String(body.bank_account ?? "").trim();
  const ifsc = String(body.bank_ifsc ?? "")
    .trim()
    .toUpperCase();
  const upi = String(body.upi_id ?? "").trim();
  if (acct && !/^\d{9,18}$/.test(acct)) return "bank_account must be 9–18 digits";
  if (ifsc && !IFSC_RE.test(ifsc)) return "bank_ifsc invalid (e.g. HDFC0001234)";
  if (upi && !UPI_RE.test(upi)) return "upi_id invalid (e.g. name@okhdfc)";
  if (mode === "bank" && (!acct || !ifsc)) return "bank_account + bank_ifsc required";
  if (mode === "upi" && !upi) return "upi_id required";
  if (mode === "both" && !upi && (!acct || !ifsc))
    return "upi_id or bank_account + bank_ifsc required";
  return null;
}

async function maskedBank(enc: string | null): Promise<string> {
  if (!enc) return "—";
  try {
    const full = await decryptBankAccount(enc);
    return maskBankAccount(full);
  } catch {
    return "•••• (unreadable)";
  }
}

/** GET /api/payroll/employees — active roster + masked bank details. */
export async function GET() {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  try {
    const rows = await db()
      .select()
      .from(employees)
      .where(eq(employees.organizationId, a.organizationId));
    const out = await Promise.all(
      rows.map(async (e) => ({
        ...serialize(e),
        ...(await maskedSecrets(e.bankAccountEnc, e.upiIdEnc)),
      })),
    );
    return NextResponse.json({ employees: out }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL"))
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    return NextResponse.json({ error: "failed to list employees" }, { status: 500 });
  }
}

/** POST /api/payroll/employees — create. rate/bank in rupees/plaintext. */
export async function POST(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const code = String(body.employee_code ?? "").trim();
  const payType = String(body.pay_type ?? "");
  if (name.length < 2)
    return NextResponse.json({ error: "name required (min 2)" }, { status: 400 });
  if (code.length < 1)
    return NextResponse.json({ error: "employee_code required" }, { status: 400 });
  if (payType !== "hourly" && payType !== "salary") {
    return NextResponse.json({ error: "pay_type must be hourly or salary" }, { status: 400 });
  }
  let ratePaise: number;
  try {
    ratePaise = toPaise(Number(body.rate));
  } catch {
    return NextResponse.json({ error: "rate must be a non-negative number" }, { status: 400 });
  }
  const status = String(body.status ?? "active");
  if (status !== "active" && status !== "inactive") {
    return NextResponse.json({ error: "status must be active or inactive" }, { status: 400 });
  }
  const perr = payoutError(body);
  if (perr) return NextResponse.json({ error: perr }, { status: 400 });
  try {
    const bankEnc = body.bank_account ? await encryptBankAccount(String(body.bank_account)) : null;
    const upiEnc = body.upi_id ? await encryptBankAccount(String(body.upi_id)) : null;
    const [row] = await db()
      .insert(employees)
      .values({
        id: ulid(),
        organizationId: a.organizationId,
        outletId: body.outlet_id ? String(body.outlet_id) : null,
        name,
        email: body.email ? String(body.email) : null,
        employeeCode: code,
        payType,
        ratePaise,
        currency: String(body.currency ?? "INR"),
        bankAccountEnc: bankEnc,
        bankName: body.bank_name ? String(body.bank_name).trim() : null,
        bankIfsc: body.bank_ifsc ? String(body.bank_ifsc).trim().toUpperCase() : null,
        upiIdEnc: upiEnc,
        status,
        joiningDate: body.joining_date ? String(body.joining_date) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      })
      .returning();
    return NextResponse.json(
      {
        employee: { ...serialize(row), ...(await maskedSecrets(row.bankAccountEnc, row.upiIdEnc)) },
      },
      { status: 201, headers: noStore },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json({ error: "employee code already exists" }, { status: 409 });
    }
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    if (msg.includes("BETTER_AUTH_SECRET")) {
      return NextResponse.json({ error: "bank encryption unavailable" }, { status: 500 });
    }
    return NextResponse.json({ error: "failed to create employee" }, { status: 500 });
  }
}

/** PUT /api/payroll/employees?id= — update (rate in rupees, bank re-encrypted). */
export async function PUT(req: Request) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const patch: Partial<typeof employees.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (v.length < 2) return NextResponse.json({ error: "name too short" }, { status: 400 });
      patch.name = v;
    }
    if (body.email !== undefined) patch.email = body.email ? String(body.email) : null;
    if (body.pay_type !== undefined) {
      if (body.pay_type !== "hourly" && body.pay_type !== "salary") {
        return NextResponse.json({ error: "pay_type must be hourly or salary" }, { status: 400 });
      }
      patch.payType = body.pay_type;
    }
    if (body.rate !== undefined) {
      try {
        patch.ratePaise = toPaise(Number(body.rate));
      } catch {
        return NextResponse.json({ error: "rate must be a non-negative number" }, { status: 400 });
      }
    }
    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "inactive") {
        return NextResponse.json({ error: "status must be active or inactive" }, { status: 400 });
      }
      patch.status = body.status;
    }
    if (body.outlet_id !== undefined)
      patch.outletId = body.outlet_id ? String(body.outlet_id) : null;
    if (body.bank_account !== undefined) {
      const v = String(body.bank_account).trim();
      if (v && !/^\d{9,18}$/.test(v))
        return NextResponse.json({ error: "bank_account must be 9–18 digits" }, { status: 400 });
      patch.bankAccountEnc = v ? await encryptBankAccount(v) : null;
    }
    if (body.bank_name !== undefined)
      patch.bankName = body.bank_name ? String(body.bank_name).trim() : null;
    if (body.bank_ifsc !== undefined) {
      const v = String(body.bank_ifsc).trim().toUpperCase();
      if (v && !IFSC_RE.test(v))
        return NextResponse.json(
          { error: "bank_ifsc invalid (e.g. HDFC0001234)" },
          { status: 400 },
        );
      patch.bankIfsc = v || null;
    }
    if (body.upi_id !== undefined) {
      const v = String(body.upi_id).trim();
      if (v && !UPI_RE.test(v))
        return NextResponse.json({ error: "upi_id invalid (e.g. name@okhdfc)" }, { status: 400 });
      patch.upiIdEnc = v ? await encryptBankAccount(v) : null;
    }
    const rows = await db()
      .update(employees)
      .set(patch)
      .where(and(eq(employees.id, id), eq(employees.organizationId, a.organizationId)))
      .returning();
    if (rows.length === 0)
      return NextResponse.json({ error: "employee not found" }, { status: 404 });
    return NextResponse.json(
      {
        employee: {
          ...serialize(rows[0]),
          ...(await maskedSecrets(rows[0].bankAccountEnc, rows[0].upiIdEnc)),
        },
      },
      { headers: noStore },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed to update employee" }, { status: 500 });
  }
}
