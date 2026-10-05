import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { baUser } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "pixaPOS Admin — SaaS Console",
  description:
    "Organisation lifecycle, registrations, billing and audit for the pixaPOS owner team.",
};

const NAV = [
  { href: "/admin", label: "Overview", icon: "◧" },
  { href: "/admin/organizations", label: "Organisations", icon: "◈" },
  { href: "/admin/leads", label: "Registrations", icon: "✉" },
  { href: "/admin/billing", label: "Plans & Billing", icon: "₹" },
  { href: "/admin/audit", label: "Audit log", icon: "≡" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

/** SaaS-owner gate: session + PLATFORM_OWNER_EMAILS allowlist. Hostname is
 * never proof — the signed-in user's email decides, on every request. */
function isPlatformOwner(email?: string | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.PLATFORM_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await baUser().catch(() => null);
  if (!user) redirect("/auth/sign-in");
  if (!isPlatformOwner(user.email)) redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-zinc-950 text-zinc-200 md:flex">
        <div className="px-5 pt-6 pb-4">
          <p className="text-lg font-semibold tracking-tight text-white">pixaPOS</p>
          <p className="text-xs text-zinc-400">SaaS Admin Console</p>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Admin">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-800 hover:text-white"
            >
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="p-4 text-[11px] leading-relaxed text-zinc-500">
          Workspace = billing boundary.
          <br />
          Outlet = operational boundary.
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 md:px-8">
            <p className="font-semibold md:hidden">pixaPOS Admin</p>
            <nav className="flex gap-1 overflow-x-auto text-sm md:hidden" aria-label="Admin">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="rounded-md px-2 py-1 hover:bg-zinc-100">
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="hidden rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 sm:inline">
                ● All systems operational
              </span>
              <span
                className="grid size-8 place-items-center rounded-full bg-zinc-950 font-semibold text-white"
                aria-label={user.email ?? "owner"}
              >
                {(user.email ?? "A").charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
