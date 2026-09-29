"use client";

import { useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Icons } from "@pixa/ui/icons";

const TERMINAL_APPS = [
  {
    name: "POS Terminal",
    route: "/pos",
    hint: "Counter orders, bills and collection",
    icon: "receipt" as const,
  },
  {
    name: "Kitchen Display",
    route: "/kds",
    hint: "Ticket wallboard for the kitchen",
    icon: "kitchen" as const,
  },
  {
    name: "Kiosk",
    route: "/kiosk",
    hint: "Customer self-ordering",
    icon: "cards" as const,
  },
  {
    name: "Table QR",
    route: "/qr",
    hint: "Scan-to-order from the table",
    icon: "receipt" as const,
  },
];

/**
 * Header launcher: opens the standalone terminal apps (each a separate
 * PWA surface in a new tab) instead of linking out to GitHub.
 */
export default function CtaGithub() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="Open terminal apps — POS, Kitchen, Kiosk, QR"
        aria-label="Open terminal apps"
        className="group text-muted-foreground"
      >
        <Icons.cards className="size-4 transition-transform duration-300 group-hover:scale-110" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Terminal apps</DialogTitle>
            <DialogDescription>
              Standalone surfaces — each opens in a new tab and installs as its own app.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {TERMINAL_APPS.map((app) => {
              const Icon = Icons[app.icon];
              return (
                <button
                  key={app.route}
                  type="button"
                  onClick={() => {
                    window.open(app.route, "_blank", "noopener");
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{app.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{app.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
