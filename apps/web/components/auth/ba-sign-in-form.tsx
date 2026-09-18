"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

/**
 * shadcn-style sign-in: social button up top, divider, email form, footer
 * link. Error presentation goes through Sonner (per better-auth-ui guidance);
 * field errors stay inline on the inputs.
 */
export default function BaSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setPending(true);
    const { error } = await authClient.signIn.email(
      { email: email.trim(), password, callbackURL: "/dashboard" },
      { onError: () => setPending(false) },
    );
    if (error) {
      const message = error.message ?? "Sign in failed";
      setFieldError(message);
      toast.error(message);
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
      toast.error(error.message ?? "Google sign in failed");
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your pixaPOS account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <Button variant="outline" className="w-full" disabled={pending} onClick={google}>
                <Icons.google className="size-4" />
                Continue with Google
              </Button>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
              <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ba-email">Email</Label>
                  <Input
                    id="ba-email"
                    type="email"
                    placeholder="owner@restaurant.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={fieldError ? true : undefined}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="ba-password">Password</Label>
                  </div>
                  <Input
                    id="ba-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? "ba-signin-error" : undefined}
                  />
                </div>
                {fieldError && (
                  <p id="ba-signin-error" role="alert" className="text-sm text-destructive">
                    {fieldError}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
              <p className={cn("text-center text-sm text-muted-foreground")}>
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/sign-up"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
