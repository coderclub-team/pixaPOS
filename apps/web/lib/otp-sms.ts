/**
 * Server-only OTP SMS sender for Better Auth phone verification.
 *
 * Uses env-configured SMS providers (reusing the tested dispatchSend senders
 * from the owner messaging stack). In non-production, when no provider is
 * configured, the code is logged to the server console so the flow is
 * testable end-to-end. Production without a provider fails loudly.
 */
import { dispatchSend, type ProviderConfig } from "@/lib/messaging-providers";

function envSmsProvider(): { provider: string; cfg: ProviderConfig } | null {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    return {
      provider: "twilio",
      cfg: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_FROM,
      },
    };
  }
  if (process.env.MSG91_AUTH_KEY) {
    return {
      provider: "msg91",
      cfg: {
        authKey: process.env.MSG91_AUTH_KEY,
        senderId: process.env.MSG91_SENDER_ID ?? "PIXAPS",
        flowId: process.env.MSG91_FLOW_ID ?? "",
        route: process.env.MSG91_ROUTE ?? "4",
      },
    };
  }
  if (process.env.TEXTLOCAL_API_KEY) {
    return {
      provider: "textlocal",
      cfg: {
        apiKey: process.env.TEXTLOCAL_API_KEY,
        sender: process.env.TEXTLOCAL_SENDER ?? "PIXAPS",
      },
    };
  }
  return null;
}

/** MSG91/TextLocal expect a bare 10–12 digit number; Twilio wants E.164. */
function toProviderNumber(provider: string, phoneNumber: string): string {
  if (provider === "msg91" || provider === "textlocal") {
    return phoneNumber.replace(/^\+/, "").replace(/^91(?=\d{10}$)/, "");
  }
  return phoneNumber;
}

export function isOtpSmsConfigured(): boolean {
  return envSmsProvider() !== null;
}

export async function sendOtpSms(phoneNumber: string, code: string): Promise<void> {
  const body = `${code} is your pixaPOS verification code. Valid for 5 minutes. Do not share it with anyone.`;
  const provider = envSmsProvider();

  if (!provider) {
    // Log the code where SMS isn't wired: local dev, or any non-prod env with
    // OTP_DEV_LOG=true (set on Vercel Development/Preview). Production without a
    // provider fails loudly so we never silently drop a verification.
    const allowLog = process.env.NODE_ENV !== "production" || process.env.OTP_DEV_LOG === "true";
    if (allowLog) {
      console.info(`[pixaPOS OTP] ${phoneNumber} -> ${code}`);
      return;
    }
    throw new Error(
      "No SMS provider configured for OTP. Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM or MSG91_AUTH_KEY.",
    );
  }

  const res = await dispatchSend(
    "sms",
    provider.provider,
    provider.cfg,
    toProviderNumber(provider.provider, phoneNumber),
    "",
    body,
  );
  if (!res.ok) throw new Error(res.error ?? "OTP SMS failed");
}
