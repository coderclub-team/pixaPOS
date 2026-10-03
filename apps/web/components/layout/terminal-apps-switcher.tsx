"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useIdentity } from "@/hooks/use-identity";
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
  title: string;
  blurb: string;
  icon: keyof typeof Icons;
  gated: boolean;
};

const SURFACES: Surface[] = [
  {
    href: "/dashboard",
    title: "Dashboard",
    blurb: "Sales, orders and outlet overview",
    icon: "dashboard",
    gated: true,
  },
  {
    href: "/pos",
    title: "POS terminal",
    blurb: "Counter and table billing",
    icon: "cart",
    gated: true,
  },
  {
    href: "/kds",
    title: "Kitchen display",
    blurb: "Live KOT wallboard for chefs",
    icon: "kitchen",
    gated: true,
  },
  {
    href: "/kot",
    title: "KOT",
    blurb: "Kitchen order tickets",
    icon: "clipboardList",
    gated: true,
  },
  { href: "/kiosk", title: "Kiosk", blurb: "Customer self-ordering", icon: "laptop", gated: false },
  {
    href: "/qr",
    title: "QR ordering",
    blurb: "Scan, order and pay by phone",
    icon: "receipt",
    gated: false,
  },
];

/**
 * Header app-switcher: the only sanctioned way back to the surface list
 * once inside a route. Launcher links and switches below all use
 * router.replace so browser Back never returns to `/`.
 */
export default function TerminalAppsSwitcher() {
  const router = useRouter();
  const { user } = useIdentity();
  const [open, setOpen] = React.useState(false);
  const signedIn = Boolean(user);

  const go = (href: string) => {
    setOpen(false);
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
            Jump to another operations surface. Switching replaces the current page — browser Back
            won&apos;t return here.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-[60dvh] grid-cols-1 gap-2 overflow-y-auto">
          {SURFACES.map((s) => {
            const locked = s.gated && !signedIn;
            const Icon = Icons[s.icon];
            return (
              <li key={s.href}>
                <button
                  type="button"
                  onClick={() => go(locked ? "/auth/sign-in" : s.href)}
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
