import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBaUser } from "@/lib/auth-session";
import OnboardingForm from "./form";

export const metadata: Metadata = {
  title: "Onboarding | pixaPOS",
  description: "Set up your business workspace and start your 14-day trial.",
};

export default async function OnboardingPage() {
  const user = await requireBaUser();
  if ((user as { phoneNumberVerified?: boolean }).phoneNumberVerified === false) {
    redirect("/auth/verify-phone");
  }
  return <OnboardingForm />;
}
