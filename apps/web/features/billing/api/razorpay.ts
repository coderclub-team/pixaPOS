/**
 * Razorpay server adapter skeleton (Phase 2 wiring).
 *
 * SERVER-ONLY: uses Node crypto + secret env vars. Import only from Route
 * Handlers / server code — never from client components (it would leak the
 * secret into the browser bundle). No `server-only` package in this repo, so
 * the import boundary is enforced by convention + this runtime guard.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

if (typeof window !== "undefined") {
  throw new Error("features/billing/api/razorpay is server-only");
}

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

export function isRazorpayConfigured(): boolean {
  return KEY_ID.length > 0 && KEY_SECRET.length > 0;
}

async function rzp<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isRazorpayConfigured()) throw new Error("Razorpay keys not configured");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error(
        "Razorpay rejected the API keys (401 Unauthorized) — regenerate the test key pair in the Razorpay Dashboard and update RAZORPAY_KEY_ID/SECRET",
      );
    }
    throw new Error(`Razorpay ${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export type RzpSubscription = {
  id: string;
  status: string;
  plan_id: string;
  customer_id?: string | null;
  current_start?: number | null;
  current_end?: number | null;
};

/** Step 2 of the Razorpay flow: customer picked the plan on our page. */
export async function createRazorpaySubscription(params: {
  plan_id: string;
  /** Trial = future start (Razorpay treats pre-start as the trial window). */
  start_at_unix: number;
  total_count?: number;
  customer_notify?: boolean;
}): Promise<RzpSubscription> {
  return rzp<RzpSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: params.plan_id,
      start_at: params.start_at_unix,
      total_count: params.total_count ?? 12,
      quantity: 1,
      customer_notify: params.customer_notify ?? true,
    }),
  });
}

/** Step 4+: fetch latest state before rendering (source of truth for status). */
export async function fetchRazorpaySubscription(id: string): Promise<RzpSubscription> {
  return rzp<RzpSubscription>(`/subscriptions/${id}`);
}

export async function cancelRazorpaySubscription(id: string): Promise<RzpSubscription> {
  return rzp<RzpSubscription>(`/subscriptions/${id}/cancel`, { method: "POST" });
}

/** Webhook authenticity: HMAC-SHA256 of the raw body vs the signature header. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
