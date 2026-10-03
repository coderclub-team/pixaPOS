import Link from "next/link";
import { redirect } from "next/navigation";
import { baSession } from "@/lib/auth-session";
import { Icons } from "@pixa/ui/icons";
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
    href: "/dispatch",
    title: "Dispatch console",
    blurb: "Pack, assign riders, send out",
    icon: "send",
    gated: true,
  },
  {
    href: "/rider",
    title: "Rider",
    blurb: "My assigned deliveries",
    icon: "user",
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
  // No anonymous launcher: unsigned visitors go to sign-in. The surface
  // list below is the post-login home.
  if (!session?.user) redirect("/auth/sign-in");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">pixaPOS — Restaurant Operations</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {session.user.name ?? "operator"}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Jump into any operations surface. Staff areas stay behind your sign-in.
        </p>
      </header>

      <nav aria-label="Operations surfaces">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACES.map((s) => {
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
    </main>
  );
}
