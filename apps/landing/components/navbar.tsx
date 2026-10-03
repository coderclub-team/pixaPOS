import Link from "next/link";
import { APP_URL, signInUrl, signUpUrl } from "@/lib/site";
import { Icons } from "@pixa/ui/icons";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { cn } from "@pixa/ui/lib/utils";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-(--border) bg-(--background)/80 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6"
      >
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-(--primary) text-sm text-(--primary-foreground)">
            P
          </span>
          pixaPOS
        </Link>
        <div className="ml-4 hidden items-center gap-5 text-sm text-(--muted-foreground) md:flex">
          <Link href="#surfaces" className="hover:text-(--foreground)">
            Surfaces
          </Link>
          <Link href="#pricing" className="hover:text-(--foreground)">
            Pricing
          </Link>
          <Link href="#customers" className="hover:text-(--foreground)">
            Customers
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={signInUrl()} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Log in
          </Link>
          <Link href={signUpUrl()} className={cn(buttonVariants({ size: "sm" }))}>
            Start free trial
            <Icons.arrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </nav>
      <span className="sr-only">App: {APP_URL}</span>
    </header>
  );
}
