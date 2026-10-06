import type { Metadata } from "next";
import OnboardingForm from "./form";

export const metadata: Metadata = {
  title: "Onboarding | pixaPOS",
  description: "Set up your business workspace and start your 14-day trial.",
};

export default function OnboardingPage() {
  return <OnboardingForm />;
}
