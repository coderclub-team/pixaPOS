import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, employees } from "@pixa/db";
import { payrollAuth, noStore } from "@/features/payroll/api/authz";
import { decryptBankAccount } from "@/lib/bank-crypto";
import { lookupIfsc, validateVpa } from "@/lib/payout-verify";

export const dynamic = "force-dynamic";

type Status = "unverified" | "pending" | "verified" | "failed" | "unavailable";

/**
 * POST /api/payroll/employees/:id/verify — background verification of payout
 * details (org:payroll:manage). Non-blocking and advisory: failures never
 * prevent saving or paying, they only annotate the employee record.
 *
 * - Bank: free IFSC existence lookup (+ bank-name cross-check).
 * - UPI: Razorpay VPA existence + holder name (unavailable when the
 *   UPI-Collect endpoint is disabled for these keys — never "invalid").
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await payrollAuth("org:payroll:manage");
  if (a instanceof NextResponse) return a;
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const database = db();
    const [emp] = await database
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.organizationId, a.organizationId)))
      .limit(1);
    if (!emp) return NextResponse.json({ error: "employee not found" }, { status: 404 });

    const bank = { checked: false, ok: false, unavailable: false, detail: "" };
    const upi = { checked: false, ok: false, unavailable: false, detail: "" };
    const patch: Partial<typeof employees.$inferInsert> = { updatedAt: new Date() };

    if (emp.bankIfsc) {
      bank.checked = true;
      const r = await lookupIfsc(emp.bankIfsc);
      if (r.unavailable) {
        bank.unavailable = true;
        bank.detail = r.error ?? "IFSC lookup unavailable";
      } else if (r.ok) {
        bank.ok = true;
        bank.detail = r.branch ? `${r.bank} — ${r.branch}` : (r.bank ?? "IFSC exists");
        patch.bankIfscVerifiedAt = new Date();
        patch.bankIfscBank = r.bank ?? null;
      } else {
        bank.detail = r.error ?? "IFSC not found";
        patch.bankIfscVerifiedAt = null;
        patch.bankIfscBank = null;
      }
    }

    if (emp.upiIdEnc) {
      upi.checked = true;
      let vpa: string | null = null;
      try {
        vpa = await decryptBankAccount(emp.upiIdEnc);
      } catch {
        vpa = null;
      }
      if (!vpa) {
        upi.detail = "UPI ID unreadable";
      } else {
        const r = await validateVpa(vpa);
        if (r.unavailable) {
          upi.unavailable = true;
          upi.detail = r.error ?? "UPI validation unavailable";
        } else if (r.ok) {
          upi.ok = true;
          upi.detail = r.holderName ? `Active — ${r.holderName}` : "UPI ID exists";
          patch.upiVerifiedAt = new Date();
          patch.upiHolderName = r.holderName ?? null;
        } else {
          upi.detail = r.error ?? "UPI ID does not exist";
          patch.upiVerifiedAt = null;
          patch.upiHolderName = null;
        }
      }
    }

    let status: Status = "unverified";
    const anyChecked = bank.checked || upi.checked;
    const allCheckedOk = anyChecked && (!bank.checked || bank.ok) && (!upi.checked || upi.ok);
    const anyFailed =
      (bank.checked && !bank.ok && !bank.unavailable) ||
      (upi.checked && !upi.ok && !upi.unavailable);
    if (allCheckedOk) status = "verified";
    else if (anyFailed) status = "failed";
    else if (anyChecked) status = "unavailable";
    patch.verificationStatus = status;

    await database.update(employees).set(patch).where(eq(employees.id, id));

    return NextResponse.json({ verification_status: status, bank, upi }, { headers: noStore });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (process.env.VITEST_WORKER_ID) {
      const cause = e instanceof Error && e.cause ? String(e.cause).slice(0, 300) : "";
      return NextResponse.json(
        { error: `verification failed: ${msg.slice(0, 200)} || cause: ${cause}` },
        { status: 500 },
      );
    }
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "verification failed" }, { status: 500 });
  }
}
