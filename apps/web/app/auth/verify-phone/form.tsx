"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

type PhoneClient = {
  sendOtp: (args: {
    phoneNumber: string;
  }) => Promise<{ error?: { message?: string } | null } | undefined>;
  verify: (args: {
    phoneNumber: string;
    code: string;
    updatePhoneNumber?: boolean;
  }) => Promise<{ error?: { message?: string } | null; data?: unknown } | undefined>;
};

const phoneApi = (authClient as unknown as { phoneNumber: PhoneClient }).phoneNumber;

type SessionData = { user?: { phoneNumberVerified?: boolean } } | null;
const useBaSession = (
  authClient as unknown as { useSession: () => { data: SessionData; isPending: boolean } }
).useSession;

/** Normalize to E.164-ish: 10-digit → +91XXXXXXXXXX. */
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  return cleaned ? `+${cleaned}` : "";
}

export default function VerifyPhoneForm() {
  const router = useRouter();
  const { data: session, isPending } = useBaSession();
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const verified = session?.user?.phoneNumberVerified;

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/auth/sign-in");
    if (!isPending && verified) router.replace("/dashboard");
  }, [isPending, session, verified, router]);

  const sendOtp = async () => {
    const phoneNumber = normalizePhone(phone);
    if (!/^\+[1-9]\d{9,14}$/.test(phoneNumber)) {
      toast.error("Enter a valid mobile number");
      return;
    }
    setBusy(true);
    try {
      const res = await phoneApi.sendOtp({ phoneNumber });
      if (res?.error) throw new Error(res.error.message ?? "Could not send code");
      setPhone(phoneNumber);
      setOtpSent(true);
      toast.success("Verification code sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 4) {
      toast.error("Enter the code from the SMS");
      return;
    }
    setBusy(true);
    try {
      const res = await phoneApi.verify({
        phoneNumber: normalizePhone(phone),
        code: code.trim(),
        updatePhoneNumber: true,
      });
      if (res?.error) throw new Error(res.error.message ?? "Invalid or expired code");
      toast.success("Mobile number verified");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Verify your mobile number</CardTitle>
            <CardDescription>
              We send a one-time code to your mobile. We use this number for booking follow-ups and
              payment receipts — it is never shared.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vp-phone">Mobile number</Label>
              <Input
                id="vp-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={phone}
                disabled={otpSent || busy}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {otpSent && (
              <div className="grid gap-2">
                <Label htmlFor="vp-code">6-digit code</Label>
                <Input
                  id="vp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="______"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {!otpSent ? (
              <Button className="w-full" disabled={busy} onClick={() => void sendOtp()}>
                <Icons.send className="size-4" aria-hidden />
                {busy ? "Sending…" : "Send code"}
              </Button>
            ) : (
              <div className="grid gap-2">
                <Button className="w-full" disabled={busy} onClick={() => void verify()}>
                  <Icons.check className="size-4" aria-hidden />
                  {busy ? "Verifying…" : "Verify & continue"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setOtpSent(false);
                    setCode("");
                  }}
                >
                  Change number / resend
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Verification is required before you can use pixaPOS.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
