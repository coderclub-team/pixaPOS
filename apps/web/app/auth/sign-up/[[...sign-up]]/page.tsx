import type { Metadata } from "next";
import BaSignUpForm from "@/components/auth/ba-sign-up-form";

export const metadata: Metadata = {
  title: "Authentication | Sign Up",
  description: "Sign Up page for authentication.",
};

export default function SignUpPage() {
  return <BaSignUpForm />;
}
