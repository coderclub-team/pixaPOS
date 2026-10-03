import Link from "next/link";
import { signUpUrl } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";
import { Icons } from "@pixa/ui/icons";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { cn } from "@pixa/ui/lib/utils";

export default function CtaBanner() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="rounded-2xl bg-(--primary) px-6 py-12 text-center text-(--primary-foreground)">
        <h2 className="mx-auto max-w-xl text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Start your {TRIAL_DAYS}-day free trial — no credit card required
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm opacity-80">
          Import your menu, seat your first table and fire your first KOT in under an hour. Cancel
          anytime.
        </p>
        <Link
          href={signUpUrl()}
          className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-6")}
        >
          Get started free
          <Icons.arrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
