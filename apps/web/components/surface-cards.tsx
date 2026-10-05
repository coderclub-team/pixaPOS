import Link from "next/link";
import { Icons } from "@pixa/ui/icons";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { cn } from "@pixa/ui/lib/utils";

export type SurfaceLink = {
  href: string;
  title: string;
  blurb: string;
  icon: keyof typeof Icons;
};

/**
 * Post-login surface picker (moved from the `/` launcher when `/` became
 * the marketing site). Rendered by the dashboard home for overview-bound
 * roles; role fast-paths (kitchen → KDS, counter → POS) bypass it.
 */
export const SURFACE_LINKS: SurfaceLink[] = [
  { href: "/pos", title: "POS terminal", blurb: "Counter and table billing", icon: "cart" },
  {
    href: "/kds",
    title: "Kitchen display",
    blurb: "Live KOT wallboard for chefs",
    icon: "kitchen",
  },
  {
    href: "/dispatch",
    title: "Dispatch console",
    blurb: "Pack, assign riders, send out",
    icon: "send",
  },
  { href: "/rider", title: "Rider", blurb: "My assigned deliveries", icon: "user" },
  { href: "/kot", title: "KOT", blurb: "Kitchen order tickets", icon: "clipboardList" },
  { href: "/kiosk", title: "Kiosk", blurb: "Customer self-ordering", icon: "laptop" },
  { href: "/qr", title: "QR ordering", blurb: "Scan, order and pay by phone", icon: "receipt" },
];

export default function SurfaceCards({ userName }: { userName?: string | null }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">pixaPOS — Restaurant Operations</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Jump into any operations surface. Staff areas stay behind your sign-in.
        </p>
      </header>

      <nav aria-label="Operations surfaces">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACE_LINKS.map((s) => {
            const Icon = Icons[s.icon];
            return (
              <li key={s.href}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="size-5 text-primary" aria-hidden />
                      {s.title}
                      <Icons.arrowRight
                        className="ml-auto size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </CardTitle>
                    <CardDescription>{s.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={s.href}
                      replace
                      aria-label={`Open ${s.title}`}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                    >
                      Open {s.title}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
