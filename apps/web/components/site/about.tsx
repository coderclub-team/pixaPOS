import Link from "next/link";
import { signUpUrl } from "@/lib/site/site";

export default function About() {
  return (
    <section id="about" className="bg-gray-1 pt-20 pb-8 lg:pt-[120px] lg:pb-[70px] dark:bg-dark-2">
      <div className="container">
        <div>
          <div className="-mx-4 flex flex-wrap items-center">
            <div className="w-full px-4 lg:w-1/2">
              <div className="mb-12 max-w-[540px] lg:mb-0">
                <h2 className="mb-5 text-3xl leading-tight font-bold text-dark sm:text-[40px] sm:leading-[1.2] dark:text-white">
                  Brilliant Toolkit to Run Restaurant Businesses.
                </h2>
                <p className="mb-10 text-base leading-relaxed text-body-color dark:text-dark-6">
                  The main thrust is to focus on educating attendees on how to best protect highly
                  vulnerable business applications with interactive panel discussions and
                  roundtables led by subject matter experts.
                  <br /> <br />
                  The main thrust is to focus on educating attendees on how to best protect highly
                  vulnerable business applications with interactive panel.
                </p>
                <Link
                  href={signUpUrl()}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-7 py-3 text-center text-base font-medium text-white duration-300 hover:bg-primary/90"
                >
                  Know More
                </Link>
              </div>
            </div>

            <div className="w-full px-4 lg:w-1/2">
              <div className="-mx-2 flex flex-wrap sm:-mx-4 lg:-mx-2 xl:-mx-4">
                <div className="w-full px-2 sm:w-1/2 sm:px-4 lg:px-2 xl:px-4">
                  <div className="relative mb-4 sm:mb-8 sm:h-[400px] md:h-[540px] lg:h-[400px] xl:h-[500px]">
                    <div className="flex h-full w-full flex-col justify-end rounded-xl bg-primary p-6 object-cover">
                      <p className="text-2xl font-bold text-white">POS Terminal</p>
                      <p className="text-white/70">Billing, KOT, collection</p>
                    </div>
                  </div>
                </div>

                <div className="w-full px-2 sm:w-1/2 sm:px-4 lg:px-2 xl:px-4">
                  <div className="relative mb-4 sm:mb-8 sm:h-[220px] md:h-[346px] lg:mb-4 lg:h-[225px] xl:mb-8 xl:h-[310px]">
                    <div className="flex h-full w-full flex-col justify-end rounded-xl bg-dark p-6 dark:bg-white">
                      <p className="text-2xl font-bold text-white dark:text-dark">KDS Wallboard</p>
                      <p className="text-white/70 dark:text-dark/70">Tickets, lines, timers</p>
                    </div>
                  </div>

                  <div className="relative z-10 mb-4 flex items-center justify-center overflow-hidden bg-primary px-6 py-12 sm:mb-8 sm:h-[160px] sm:p-5 lg:mb-4 xl:mb-8">
                    <div>
                      <span className="block text-5xl font-extrabold text-white">14</span>
                      <span className="block text-base font-semibold text-white">Days free</span>
                      <span className="block text-base font-medium text-white/70">
                        No card required
                      </span>
                    </div>
                    <span className="absolute top-0 left-0 -z-10">
                      <svg width="106" height="144" viewBox="0 0 106 144" fill="none">
                        <rect
                          opacity="0.1"
                          x="-67"
                          y="47.127"
                          width="113.378"
                          height="131.304"
                          transform="rotate(-42.8643 -67 47.127)"
                          fill="white"
                        />
                      </svg>
                    </span>
                    <span className="absolute top-0 right-0 -z-10">
                      <svg width="130" height="97" viewBox="0 0 130 97" fill="none">
                        <rect
                          opacity="0.1"
                          x="0.86792"
                          y="-6.67725"
                          width="155.563"
                          height="140.614"
                          transform="rotate(-42.8643 0.86792 -6.67725)"
                          fill="white"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
