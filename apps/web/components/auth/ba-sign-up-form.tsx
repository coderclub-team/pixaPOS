"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

/** Better Auth email/password sign-up (Phase 1: lives beside Clerk pages). */
export default function BaSignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const { error } = await authClient.signUp.email(
      { name: name.trim(), email: email.trim(), password, callbackURL: "/dashboard" },
      { onError: () => setPending(false) },
    );
    if (error) {
      toast.error(error.message ?? "Sign up failed");
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const google = async () => {
    setPending(true);
    const { error } = await authClient.signIn.social(
      { provider: "google", callbackURL: "/dashboard" },
      { onError: () => setPending(false) },
    );
    if (error) {
      toast.error(error.message ?? "Google sign up failed");
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" disabled={pending} onClick={google}>
            Continue with Google
          </Button>
          <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or with email{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ba-name">Name</Label>
              <Input id="ba-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ba-email">Email</Label>
              <Input
                id="ba-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ba-password">Password</Label>
              <Input
                id="ba-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={pending}>
              {pending ? "Creating…" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Have an account?{" "}
              <Link href="/auth/ba-sign-in" className="underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
