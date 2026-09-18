import { redirect } from "next/navigation";
import { baUser } from "@/lib/auth-session";

export default async function OverviewPage() {
  const user = await baUser();
  if (!user) redirect("/auth/sign-in");
  return null;
}
