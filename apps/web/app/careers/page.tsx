import Footer from "@/components/site/footer";
import Navbar from "@/components/site/navbar";
import Careers from "@/components/site/careers";

export default function CareersPage() {
  return (
    <main className="site-theme bg-slate-50 text-slate-900 dark:bg-dark dark:text-white">
      <Navbar />
      <section className="pt-32 pb-8 md:pt-40">
        <div className="container">
          <div className="mx-auto max-w-4xl text-center" data-reveal>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#138AF2]">
              Join the team
            </p>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-900 dark:text-white md:text-6xl">
              Build the future of restaurant operations.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
              We are hiring builders, operators, and support specialists who want to help
              restaurants run smarter, faster, and more profitably.
            </p>
          </div>
        </div>
      </section>
      <Careers />
      <Footer />
    </main>
  );
}
