import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { baUser } from "@/lib/auth-session";
import { getOwnerSession } from "@/lib/saas-owner";
import Header from "@/components/layout/header";
import KBar from "@/components/kbar";
import { SidebarInset, SidebarProvider } from "@pixa/ui/base-ui/sidebar";
import AdminSidebar from "./admin-sidebar";

/**
 * Owner gate (console group). Identity comes ONLY from the isolated
 * `pixa_owner` session — never a restaurant Better Auth session, never a
 * device/offline cookie, never the hostname. Each request revalidates the
 * server-side session row, so logout/revoke takes effect immediately.
 *
 * Shell matches the restaurant surfaces: same SidebarProvider/SidebarInset
 * primitives and the shared Header (sidebar trigger, breadcrumbs, search,
 * theme toggle, notifications).
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const owner = await getOwnerSession().catch(() => null);
  if (!owner) {
    // Signed-in restaurant user stumbling in here goes home; everyone else
    // gets the owner login. Either way, no owner session → no console.
    const user = await baUser().catch(() => null);
    redirect(user ? "/dashboard" : "/admin/login");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <KBar>
      <SidebarProvider defaultOpen={defaultOpen}>
        <a
          href="#main-content"
          className="bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2"
        >
          Skip to content
        </a>
        <AdminSidebar ownerEmail={owner.email} />
        <SidebarInset id="main-content" tabIndex={-1} className="scroll-mt-16">
          <Header showSurfaceSwitcher={false} />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
