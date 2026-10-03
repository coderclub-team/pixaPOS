import Link from "next/link";
import { signInUrl, signUpUrl } from "@/lib/site";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Surfaces", href: "#surfaces" },
      { label: "Pricing", href: "#pricing" },
      { label: "Customers", href: "#customers" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Start free trial", href: signUpUrl() },
      { label: "Log in", href: signInUrl() },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-(--border)">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-(--primary) text-sm text-(--primary-foreground)">
              P
            </span>
            pixaPOS
          </p>
          <p className="mt-3 max-w-xs text-sm text-(--muted-foreground)">
            Local-first restaurant operations — POS, kitchen, delivery. One account, one
            subscription, every outlet.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 grid gap-2 text-sm text-(--muted-foreground)">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-(--foreground)">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-(--border)">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-(--muted-foreground) sm:px-6">
          © 2026 pixaPOS · 14-day free trial · No credit card required
        </p>
      </div>
    </footer>
  );
}
