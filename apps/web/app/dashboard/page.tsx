import { redirect } from "next/navigation";
import { baMemberRole, baOrgId, baUser } from "@/lib/auth-session";

/**
 * Dashboard home: role fast-paths stay (wall tablets must land directly),
 * everyone else lands on the overview dashboard. Surfaces are selected from
 * the header switcher — never from in-page cards.
 */
function targetForRole(role: string | null): string | null {
  const r = (role ?? "").replace(/^org:/, "");
  if (r === "kitchen") return "/kds";
  if (r === "waiter" || r === "cashier") return "/pos";
  return null;
}

export default async function DashboardPage() {
  const user = await baUser().catch(() => null);
  if (!user) redirect("/auth/sign-in");
  let role: string | null = null;
  try {
    const orgId = await baOrgId();
    if (orgId) role = await baMemberRole(orgId, user.id);
  } catch {}
  const fastPath = targetForRole(role);
  redirect(fastPath ?? "/dashboard/overview");
}
