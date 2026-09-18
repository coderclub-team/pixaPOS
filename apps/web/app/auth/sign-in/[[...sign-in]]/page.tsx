import type { Metadata } from "next";
import BaSignInForm from "@/components/auth/ba-sign-in-form";

export const metadata: Metadata = {
  title: "Authentication | Sign In",
  description: "Sign In page for authentication.",
};

export default function SignInPage() {
  return <BaSignInForm />;
}
