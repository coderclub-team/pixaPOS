import Link from "next/link";
import SectionTitle from "@/components/site/section-title";
import { signUpUrl } from "@/lib/site/site";

const POSTS = [
  {
    slug: "offline-first-restaurant-pos",
    title: "Why offline-first wins the lunch rush",
    excerpt:
      "When internet drops during peak hours, a reliable POS keeps billing, kitchen prep, and order tracking moving without disruption.",
    date: "Oct 01, 2026",
    tint: "bg-primary",
  },
  {
    slug: "delivery-dispatch-done-right",
    title: "Dispatch boards that end delivery chaos",
    excerpt:
      "Clear rider assignment, status updates, and live order movement help teams reduce late deliveries and improve customer experience.",
    date: "Sep 24, 2026",
    tint: "bg-secondary",
  },
  {
    slug: "per-outlet-pricing-explained",
    title: "Per-outlet pricing, explained honestly",
    excerpt:
      "A single, transparent plan structure helps food brands grow from one outlet to a multi-branch operation without workflow complexity.",
    date: "Sep 16, 2026",
    tint: "bg-warn",
  },
];

export default function BlogSection() {
  return (
    <section className="bg-white pt-20 pb-10 lg:pt-[120px] lg:pb-20 dark:bg-dark">
      <div className="container mx-auto">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Our Blogs"
            title="Our Recent News"
            paragraph="Insights for restaurant teams managing service speed, outlet growth, stock visibility, and better customer retention."
            width="640px"
            center
          />
        </div>

        <div className="-mx-4 flex flex-wrap">
          {POSTS.map((blog) => (
            <div key={blog.slug} className="w-full px-4 md:w-1/2 lg:w-1/3">
              <div className="group mb-10">
                <div className="mb-8 overflow-hidden rounded">
                  <Link
                    href={signUpUrl()}
                    aria-label="blog cover"
                    className={`block h-[272px] w-full ${blog.tint} transition duration-300 group-hover:scale-105`}
                  >
                    <span className="flex h-full items-center justify-center px-8 text-center text-2xl font-bold text-white">
                      {blog.title}
                    </span>
                  </Link>
                </div>
                <div>
                  <span className="mb-5 inline-block rounded bg-primary px-4 py-1 text-center text-xs leading-loose font-semibold text-white">
                    {blog.date}
                  </span>
                  <h3>
                    <Link
                      href={signUpUrl()}
                      className="mb-4 inline-block text-xl font-semibold text-dark hover:text-primary sm:text-2xl lg:text-xl xl:text-2xl dark:text-white dark:hover:text-primary"
                    >
                      {blog.title}
                    </Link>
                  </h3>
                  <p className="text-base text-body-color dark:text-dark-6">{blog.excerpt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
