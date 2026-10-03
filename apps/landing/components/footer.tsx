import Link from "next/link";
import { signInUrl } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="border-t border-(--border)">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-(--muted-foreground) sm:flex-row sm:items-center sm:px-6">
        <p className="font-semibold text-(--foreground)">pixaPOS</p>
        <p>Local-first restaurant operations — POS, kitchen, delivery.</p>
        <nav aria-label="Footer" className="flex gap-4 sm:ml-auto">
          <Link href="#surfaces" className="hover:text-(--foreground)">
            Surfaces
          </Link>
          <Link href="#pricing" className="hover:text-(--foreground)">
            Pricing
          </Link>
          <Link href={signInUrl()}>Log in</Link>
        </nav>
      </div>
    </footer>
  );
}
