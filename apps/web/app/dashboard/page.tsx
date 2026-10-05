import { redirect } from "next/navigation";
import SurfaceCards from "@/components/surface-cards";
import { baMemberRole, baOrgId, baUser } from "@/lib/auth-session";

/**
 * Dashboard home: role fast-paths stay (wall tablets must land directly),
 * everyone else gets the surface picker (folded in from the old `/`
 * launcher when `/` became the marketing site).
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
  if (fastPath) redirect(fastPath);
  return <SurfaceCards userName={user.name} />;
}
