import type { Metadata } from "next";
import VerifyPhoneForm from "./form";

export const metadata: Metadata = {
  title: "Verify mobile | pixaPOS",
  description: "Verify your mobile number with a one-time code.",
  robots: { index: false, follow: false },
};

export default function VerifyPhonePage() {
  return <VerifyPhoneForm />;
}
