/**
 * Payout-detail verification (payment-gateway keys only — no RazorpayX needed).
 *
 * - Bank: free IFSC lookup (https://ifsc.razorpay.com). Confirms the IFSC
 *   exists and returns the bank/branch. Does NOT prove account ownership —
 *   that needs RazorpayX penny-drop (see RazorpayXProvider stub below).
 * - UPI: Razorpay `POST /v1/payments/validate/vpa` returns existence +
 *   holder name. Tied to UPI Collect (NPCI-deprecated Feb 2026), so a 4xx
 *   means "verification unavailable", never "invalid".
 *
 * SERVER-ONLY: uses secret env vars. Import only from Route Handlers /
 * server code — never from client components.
 */

if (typeof window !== "undefined" && !process.env.VITEST_WORKER_ID) {
  throw new Error("lib/payout-verify is server-only");
}

function gatewayKeys(): { id: string; secret: string } {
  // Read lazily (not at module load) so tests can stub env per-case.
  return {
    id: process.env.RAZORPAY_KEY_ID ?? "",
    secret: process.env.RAZORPAY_KEY_SECRET ?? "",
  };
}

function isGatewayConfigured(): boolean {
  const { id, secret } = gatewayKeys();
  return id.length > 0 && secret.length > 0;
}

export type IfscCheck = {
  ok: boolean;
  bank?: string;
  branch?: string;
  /** true when Razorpay could not be reached — caller must not treat as invalid. */
  unavailable?: boolean;
  error?: string;
};

export type VpaCheck = {
  ok: boolean;
  holderName?: string | null;
  unavailable?: boolean;
  /**
   * True when Razorpay has retired the endpoint for these keys (UPI Collect
   * deprecation) — permanent, not transient. Caller should report
   * "unsupported", never "invalid".
   */
  unsupported?: boolean;
  error?: string;
};

const FETCH_TIMEOUT_MS = 8000;

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Free IFSC lookup — no auth. Returns bank/branch when the IFSC exists. */
export async function lookupIfsc(ifsc: string): Promise<IfscCheck> {
  const code = ifsc.trim().toUpperCase();
  try {
    const res = await withTimeout((signal) =>
      fetch(`https://ifsc.razorpay.com/${encodeURIComponent(code)}`, { signal }),
    );
    if (res.status === 404) return { ok: false, error: "IFSC not found" };
    if (!res.ok)
      return { ok: false, unavailable: true, error: `IFSC lookup failed (${res.status})` };
    const data = (await res.json()) as { BANK?: string; BRANCH?: string };
    if (!data.BANK) return { ok: false, error: "IFSC not found" };
    return { ok: true, bank: data.BANK, branch: data.BRANCH };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, unavailable: true, error: `IFSC lookup unreachable: ${msg.slice(0, 120)}` };
  }
}

/** VPA existence + holder name via the Razorpay gateway API. */
export async function validateVpa(vpa: string): Promise<VpaCheck> {
  if (!isGatewayConfigured()) {
    return { ok: false, unavailable: true, error: "Razorpay keys not configured" };
  }
  const { id, secret } = gatewayKeys();
  try {
    const res = await withTimeout((signal) =>
      fetch("https://api.razorpay.com/v1/payments/validate/vpa", {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        },
        body: JSON.stringify({ vpa: vpa.trim() }),
      }),
    );
    // 4xx (e.g. UPI-Collect deprecation for this account) = unavailable, not invalid.
    if (res.status >= 400 && res.status < 500) {
      const body = await res.text().catch(() => "");
      // Razorpay retired /payments/validate/vpa with UPI Collect (Feb 2026):
      // "The requested URL was not found on the server." Permanent for these keys.
      if (/not found on the server/i.test(body)) {
        return {
          ok: false,
          unsupported: true,
          error: "UPI verification retired on these Razorpay keys (UPI Collect deprecation)",
        };
      }
      return { ok: false, unavailable: true, error: `VPA validation unavailable (${res.status})` };
    }
    if (!res.ok) {
      return { ok: false, unavailable: true, error: `VPA validation failed (${res.status})` };
    }
    const data = (await res.json()) as { success?: boolean; customer_name?: string };
    if (!data.success) return { ok: false, error: "UPI ID does not exist" };
    return { ok: true, holderName: data.customer_name ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      unavailable: true,
      error: `VPA validation unreachable: ${msg.slice(0, 120)}`,
    };
  }
}

/**
 * Future RazorpayX penny-drop provider (account-ownership proof).
 * Not wired: requires RazorpayX live keys + IP allowlisting. When available,
 * implement `validateBankOwnership` here and call it from the verify route —
 * no UI or schema changes needed beyond it.
 */
export interface OwnershipCheck {
  ok: boolean;
  registeredName?: string | null;
  nameMatchScore?: number | null;
  error?: string;
}

export async function validateBankOwnership(_opts: {
  accountNumber: string;
  ifsc: string;
  name: string;
}): Promise<OwnershipCheck> {
  void _opts;
  throw new Error("RazorpayX penny-drop not configured — needs RazorpayX live keys");
}
