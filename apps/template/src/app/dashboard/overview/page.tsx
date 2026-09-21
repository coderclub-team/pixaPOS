import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function OverviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/auth/sign-in");
  return null;
}
