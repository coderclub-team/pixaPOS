"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { outletsQueryOptions, resolveActiveOutlet } from "@/features/outlet/api/queries";
import { useIdentity } from "@/hooks/use-identity";
import type { SurfaceKey } from "@/lib/surfaces";
import { Icons } from "@pixa/ui/icons";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@pixa/ui/base-ui/dialog";
import { cn } from "@pixa/ui/lib/utils";

type Surface = {
  href: string;
  surface?: SurfaceKey;
  /** Append the active outlet code (/pos → /pos/CODE). */
  slug?: boolean;
  title: string;
  blurb: string;
  icon: keyof typeof Icons;
  gated: boolean;
};

const SURFACES: Surface[] = [
  {
    href: "/dashboard",
    surface: "dashboard",
    title: "Dashboard",
    blurb: "Sales, orders and outlet overview",
    icon: "dashboard",
    gated: true,
  },
  {
    href: "/pos",
    surface: "pos",
    slug: true,
    title: "POS terminal",
    blurb: "Counter and table billing",
    icon: "cart",
    gated: true,
  },
  {
    href: "/kds",
    surface: "kds",
    slug: true,
    title: "Kitchen display",
    blurb: "Live KOT wallboard for chefs",
    icon: "kitchen",
    gated: true,
  },
  {
    href: "/dispatch",
    surface: "dispatch",
    title: "Dispatch console",
    blurb: "Pack, assign riders, send out",
    icon: "send",
    gated: true,
  },
  {
    href: "/rider",
    surface: "rider",
    title: "Rider",
    blurb: "My assigned deliveries",
    icon: "user",
    gated: true,
  },
  {
    href: "/kot",
    surface: "kot",
    slug: true,
    title: "KOT",
    blurb: "Kitchen order tickets",
    icon: "clipboardList",
    gated: true,
  },
  {
    href: "/kiosk",
    surface: undefined,
    slug: true,
    title: "Kiosk",
    blurb: "Customer self-ordering",
    icon: "laptop",
    gated: false,
  },
  {
    href: "/qr",
    surface: undefined,
    slug: true,
    title: "QR ordering",
    blurb: "Scan, order and pay by phone",
    icon: "receipt",
    gated: false,
  },
];

/**
 * Header app-switcher (dashboard only). From /dashboard, surfaces open in a
 * new tab so the dashboard stays put; elsewhere this component isn't mounted
 * and terminal shells stay exit-less.
 */
export default function TerminalAppsSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useIdentity();
  const [open, setOpen] = React.useState(false);
  const signedIn = Boolean(user);
  // Role-derived surfaces (fail-open to all while loading/offline).
  const { data: access } = useQuery({
    queryKey: ["me", "outlets"],
    queryFn: async (): Promise<{ surfaces?: SurfaceKey[] }> => {
      try {
        const res = await fetch("/api/me/outlets", { credentials: "include" });
        if (!res.ok) return {};
        return (await res.json()) as { surfaces?: SurfaceKey[] };
      } catch {
        return {};
      }
    },
    enabled: signedIn,
    staleTime: 60_000,
  });
  const canSee = (s: Surface) =>
    !s.surface || !access?.surfaces || access.surfaces.includes(s.surface);

  const { data: outlets } = useQuery({
    ...outletsQueryOptions,
    enabled: signedIn,
  });
  const { organization } = useIdentity();
  const activeOutlet = (() => {
    const id = resolveActiveOutlet(outlets ?? []);
    return outlets?.find((o) => o.id === id) ?? null;
  })();
  const activeCode = activeOutlet?.code ?? null;
  const hrefFor = (s: Surface) => {
    if (s.slug && activeOutlet && organization?.id) {
      return `/o/${organization.id}/outlet/${activeOutlet.id}${s.href}`;
    }
    if (s.slug && activeCode) return `${s.href}/${encodeURIComponent(activeCode)}`;
    return s.href;
  };

  const go = (href: string) => {
    setOpen(false);
    // Dashboard is the ops hub: open surfaces in a new tab, keep it open.
    if (pathname?.startsWith("/dashboard")) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.replace(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            title="Switch operations surface"
            aria-label="Switch operations surface"
          >
            <Icons.cards className="size-4" aria-hidden />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch surface</DialogTitle>
          <DialogDescription>
            Jump to another operations surface. From the dashboard, surfaces open in a new tab and
            this page stays open.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-[60dvh] grid-cols-1 gap-2 overflow-y-auto">
          {SURFACES.filter(canSee).map((s) => {
            const locked = s.gated && !signedIn;
            const Icon = Icons[s.icon];
            return (
              <li key={s.href}>
                <button
                  type="button"
                  onClick={() => go(locked ? "/auth/sign-in" : hrefFor(s))}
                  aria-label={locked ? `${s.title} — sign in required` : `Switch to ${s.title}`}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    "hover:border-primary/50 hover:bg-accent",
                    "focus-visible:outline-2 focus-visible:outline-primary",
                    "min-h-11",
                  )}
                >
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.blurb}</span>
                  </span>
                  {locked && (
                    <Badge variant="secondary" className="shrink-0">
                      <Icons.lock className="size-3" aria-hidden />
                      Sign-in
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
