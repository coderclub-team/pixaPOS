import Link from "next/link";
import { baSession } from "@/lib/auth-session";
import { Icons } from "@pixa/ui/icons";
import { Badge } from "@pixa/ui/base-ui/badge";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
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
  {
    href: "/kiosk",
    title: "Kiosk",
    blurb: "Customer self-ordering",
    icon: "laptop",
    gated: false,
  },
  {
    href: "/qr",
    title: "QR ordering",
    blurb: "Scan, order and pay by phone",
    icon: "receipt",
    gated: false,
  },
];

export default async function HomePage() {
  const session = await baSession().catch(() => null);
  const signedIn = Boolean(session?.user);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">pixaPOS — Restaurant Operations</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {signedIn
            ? `Welcome back, ${session?.user?.name ?? "operator"}`
            : "Choose a surface to begin"}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {signedIn
            ? "Jump into any operations surface. Staff areas stay behind your sign-in."
            : "Staff surfaces need a sign-in; kiosk and QR ordering are open to customers."}
        </p>
        {!signedIn && (
          <div>
            <Link href="/auth/sign-in" className={buttonVariants()}>
              <Icons.login className="size-4" aria-hidden />
              Sign in
            </Link>
          </div>
        )}
      </header>

      <nav aria-label="Operations surfaces">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACES.map((s) => {
            const locked = s.gated && !signedIn;
            const Icon = Icons[s.icon];
            return (
              <li key={s.href}>
                <Card
                  className={cn(
                    "h-full transition-colors",
                    !locked && "hover:border-primary/50",
                    locked && "opacity-80",
                  )}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="size-5 text-primary" aria-hidden />
                      {s.title}
                      {locked ? (
                        <Badge variant="secondary" className="ml-auto">
                          <Icons.lock className="size-3" aria-hidden />
                          Sign-in
                        </Badge>
                      ) : (
                        <Icons.arrowRight
                          className="ml-auto size-4 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                    </CardTitle>
                    <CardDescription>{s.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={locked ? "/auth/sign-in" : s.href}
                      aria-label={locked ? `${s.title} — sign in required` : `Open ${s.title}`}
                      className={cn(
                        buttonVariants({ variant: locked ? "secondary" : "outline" }),
                        "w-full",
                      )}
                    >
                      {locked ? "Sign in to open" : `Open ${s.title}`}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </nav>
    </main>
  );
}
