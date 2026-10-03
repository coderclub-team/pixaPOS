import Link from "next/link";
import { signUpUrl } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";
import { Icons } from "@pixa/ui/icons";
import { Badge } from "@pixa/ui/base-ui/badge";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { cn } from "@pixa/ui/lib/utils";

export default function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
      <Badge variant="secondary" className="mb-5">
        {TRIAL_DAYS}-day free trial · No credit card required
      </Badge>
      <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
        The restaurant OS that keeps selling when the internet doesn&apos;t
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base text-(--muted-foreground) sm:text-lg">
        POS, kitchen display, KOT, kiosk, QR ordering and dispatch — one subscription per outlet,
        live online and offline on your own network.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href={signUpUrl()} className={cn(buttonVariants({ size: "lg" }))}>
          Start {TRIAL_DAYS}-day free trial
          <Icons.arrowRight className="size-4" aria-hidden />
        </Link>
        <Link href="#pricing" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
          See pricing
        </Link>
      </div>
      <p className="mt-4 text-xs text-(--muted-foreground)">
        Full Growth features during trial · Cancel anytime · Your menu, tables and history stay
        yours
      </p>
    </section>
  );
}
