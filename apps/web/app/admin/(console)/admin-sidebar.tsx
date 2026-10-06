"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@pixa/ui/base-ui/sidebar";
import { Icons } from "@pixa/ui/icons";

const NAV = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/organizations", label: "Organisations", icon: "workspace" },
  { href: "/admin/leads", label: "Registrations", icon: "forms" },
  { href: "/admin/billing", label: "Plans & Billing", icon: "billing" },
  { href: "/admin/crm", label: "CRM", icon: "customers" },
  { href: "/admin/tickets", label: "Tickets", icon: "chat" },
  { href: "/admin/messaging", label: "Messaging", icon: "send" },
  { href: "/admin/integrations", label: "Integrations", icon: "layers" },
  { href: "/admin/users", label: "Owner users", icon: "teams" },
  { href: "/admin/roles", label: "Owner roles", icon: "lock" },
  { href: "/admin/audit", label: "Audit log", icon: "clock" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
] as const;

export default function AdminSidebar({ ownerEmail }: { ownerEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch {
      /* logout is best-effort client-side; the cookie clear below still lands */
    }
    toast.success("Signed out");
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="group-data-[collapsible=icon]:pt-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/admin" aria-label="pixaPOS admin home" />}
                tooltip="pixaPOS SaaS Admin"
              >
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <Image
                    src="/icon.png"
                    alt="pixaPOS"
                    width={32}
                    height={32}
                    className="size-full object-cover"
                    priority
                  />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-bold">pixaPOS</span>
                  <span className="truncate text-xs text-muted-foreground">SaaS Admin</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="overflow-x-hidden">
          <SidebarGroup className="py-0">
            <SidebarMenu>
              {NAV.map((n) => {
                const Icon = Icons[n.icon];
                return (
                  <SidebarMenuItem key={n.href}>
                    <SidebarMenuButton
                      render={<Link href={n.href} aria-label={n.label} />}
                      tooltip={n.label}
                      isActive={pathname === n.href}
                    >
                      <Icon />
                      <span>{n.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="Sign out"
                onClick={() => setConfirmOpen(true)}
                className="group-data-[collapsible=icon]:justify-center"
              >
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-950 font-semibold text-white"
                  aria-hidden
                >
                  {ownerEmail.charAt(0).toUpperCase()}
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{ownerEmail}</span>
                  <span className="truncate text-xs text-muted-foreground">Sign out</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You will be returned to the console sign-in page. Your session is revoked immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={signingOut}
              onClick={() => {
                void signOut().finally(() => setSigningOut(false));
              }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
