import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@pixa/ui/base-ui/auth-card-skeleton";
import BaSignUpForm from "@/components/auth/ba-sign-up-form";

export const metadata: Metadata = {
  title: "Authentication | Sign Up",
  description: "Sign Up page for authentication.",
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <BaSignUpForm />
    </Suspense>
  );
}
