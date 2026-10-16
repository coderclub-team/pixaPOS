import { redirect } from "next/navigation";
import { baUser } from "@pixa/server";
import { getOwnerSession } from "@pixa/server";

/** Restaurant (POS) app origin for cross-app redirects. */
function webAppUrl(): string {
  return (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Admin landing: `/` has no console content of its own, so route by identity
 * plane (mirrors the console layout's gate, without rendering it):
 * - owner session → console home
 * - restaurant session only → restaurant dashboard in the web app (the owner
 *   console never accepts a restaurant session as proof)
 * - anonymous → owner login
 */
export default async function AdminLandingPage() {
  const owner = await getOwnerSession().catch(() => null);
  if (owner) redirect("/organizations");
  const user = await baUser().catch(() => null);
  redirect(user ? `${webAppUrl()}/dashboard` : "/login");
}
