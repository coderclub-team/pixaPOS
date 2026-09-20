import type { Metadata } from "next";
import { requireBaUser } from "@/lib/auth-session";
import KdsWallboard from "./wallboard";

export const metadata: Metadata = {
  title: "KDS Wallboard",
  description: "Live kitchen display — installable, works offline.",
};

export default async function KdsPage() {
  // Defense in depth alongside proxy.ts: the wallboard shows live order
  // data, so it requires a session even if middleware is bypassed. Wall
  // tablets sign in once — the session cookie persists.
  await requireBaUser();
  return <KdsWallboard />;
}
