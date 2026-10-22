import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@pixa/ui/base-ui/auth-card-skeleton";
import BaSignInForm from "@/components/auth/ba-sign-in-form";

export const metadata: Metadata = {
  title: "Authentication | Sign In",
  description: "Sign In page for authentication.",
};

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <BaSignInForm />
    </Suspense>
  );
}
