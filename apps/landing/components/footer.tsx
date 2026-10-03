import Image from "next/image";
import Link from "next/link";
import { signInUrl, signUpUrl } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Surfaces", href: "/#surfaces" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Customers", href: "/#customers" },
      { label: "FAQ", href: "/#faq" },
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
    <footer className="relative z-10 bg-[#090E34] pt-20 lg:pt-[100px]">
      <div className="container">
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4 sm:w-1/2 lg:w-4/12 xl:w-3/12">
            <div className="mb-10 w-full">
              <Link href="/" className="mb-6 inline-flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="pixaPOS"
                  width={36}
                  height={36}
                  className="size-9 rounded-lg"
                />
                <span className="text-2xl font-bold text-white">pixaPOS</span>
              </Link>
              <p className="mb-8 max-w-[270px] text-base text-gray-7">
                Local-first restaurant operations — POS, kitchen, delivery. One account, one
                subscription, every outlet.
              </p>
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title} className="w-full px-4 sm:w-1/2 lg:w-2/12">
              <div className="mb-10 w-full">
                <h4 className="mb-9 text-lg font-semibold text-white">{col.title}</h4>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="mb-3 inline-block text-base text-gray-7 hover:text-primary"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          <div className="w-full px-4 lg:w-4/12">
            <div className="mb-10 w-full">
              <h4 className="mb-9 text-lg font-semibold text-white">Trial</h4>
              <p className="mb-8 max-w-[270px] text-base text-gray-7">
                {TRIAL_DAYS} days, every Growth feature, no credit card. Cancel anytime.
              </p>
              <Link
                href={signUpUrl()}
                className="inline-block rounded-md bg-primary px-7 py-3 text-base font-medium text-white duration-300 hover:bg-primary/90"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container">
          <p className="py-4 text-center text-sm text-gray-7">
            © 2026 pixaPOS · {TRIAL_DAYS}-day free trial · No credit card required
          </p>
        </div>
      </div>
    </footer>
  );
}
