import Link from "next/link";
import { signUpUrl } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";

export default function CtaBanner() {
  return (
    <section className="relative z-10 overflow-hidden bg-primary py-20 lg:py-[115px]">
      <div className="container mx-auto">
        <div className="relative overflow-hidden">
          <div className="-mx-4 flex flex-wrap items-stretch">
            <div className="w-full px-4">
              <div className="mx-auto max-w-[570px] text-center">
                <h2 className="mb-2.5 text-3xl font-bold text-white md:text-[38px] md:leading-[1.44]">
                  <span>Ready when you are.</span>{" "}
                  <span className="text-3xl font-normal md:text-[40px]">Get started now</span>
                </h2>
                <p className="mx-auto mb-6 max-w-[515px] text-base leading-[1.5] text-white">
                  Import your menu, seat your first table and fire your first KOT in under an hour —
                  free for {TRIAL_DAYS} days, no credit card required.
                </p>
                <Link
                  href={signUpUrl()}
                  className="inline-block rounded-md bg-white px-7 py-3 text-base font-medium text-dark transition hover:bg-gray-2"
                >
                  Start {TRIAL_DAYS}-day free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <span className="absolute top-0 left-0">
          <svg
            width="495"
            height="470"
            viewBox="0 0 495 470"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="55" cy="442" r="138" stroke="white" strokeOpacity="0.04" strokeWidth="50" />
            <circle cx="446" r="39" stroke="white" strokeOpacity="0.04" strokeWidth="20" />
          </svg>
        </span>
        <span className="absolute right-0 bottom-0">
          <svg
            width="493"
            height="470"
            viewBox="0 0 493 470"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="462"
              cy="442"
              r="138"
              stroke="white"
              strokeOpacity="0.04"
              strokeWidth="50"
            />
            <circle cx="49" r="39" stroke="white" strokeOpacity="0.04" strokeWidth="20" />
          </svg>
        </span>
      </div>
    </section>
  );
}
