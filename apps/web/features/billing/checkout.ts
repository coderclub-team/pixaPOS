"use client";

/**
 * Client-safe Razorpay Standard Checkout loader. Only the public key id is
 * used here — secrets never leave the server (subscribe route + webhook).
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckoutJs(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout failed to load"));
    document.body.appendChild(script);
  });
}

export async function openRazorpaySubscriptionCheckout(params: {
  key_id: string;
  subscription_id: string;
  name: string;
  description: string;
  /** Logo shown in the checkout modal; defaults to the app logo on this host. */
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess: () => void;
  onDismiss?: () => void;
}): Promise<void> {
  await loadCheckoutJs();
  if (!window.Razorpay) throw new Error("Razorpay checkout unavailable");

  // Only prefill what we actually know from the session. Never fabricate
  // values — a fake email would route receipts nowhere. Missing fields fall
  // back to Razorpay asking the customer.
  const prefill: Record<string, string> = {};
  if (params.prefill?.name?.trim()) prefill.name = params.prefill.name.trim();
  if (params.prefill?.email?.trim()) prefill.email = params.prefill.email.trim();
  if (params.prefill?.contact?.trim()) prefill.contact = params.prefill.contact.trim();

  const image = params.image ?? `${window.location.origin}/logo.png`;

  const rzp = new window.Razorpay({
    key: params.key_id,
    subscription_id: params.subscription_id,
    image,
    ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
    name: params.name,
    description: params.description,
    handler: () => params.onSuccess(),
    modal: { ondismiss: () => params.onDismiss?.() },
  });
  rzp.open();
}
