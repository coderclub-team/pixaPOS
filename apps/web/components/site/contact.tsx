"use client";

import { useState } from "react";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Trial enquiry from ${name || "a restaurant"}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:hello@pixapos.store?subject=${subject}&body=${body}`;
  };

  const inputCls =
    "w-full rounded-md border border-stroke bg-transparent px-5 py-3 text-base text-dark outline-none placeholder:text-body-color/70 focus:border-primary focus-visible:shadow-none dark:border-dark-3 dark:text-white";

  return (
    <section id="contact" className="relative py-20 md:py-[120px]">
      <div className="absolute top-0 left-0 -z-[1] h-full w-full dark:bg-dark" />
      <div className="absolute top-0 left-0 -z-[1] h-1/2 w-full bg-primary/10 lg:h-[45%] xl:h-1/2 dark:bg-dark-700" />
      <div className="container px-4">
        <div className="-mx-4 flex flex-wrap items-center">
          <div className="w-full px-4 lg:w-7/12 xl:w-8/12">
            <div className="ud-contact-content-wrapper">
              <div className="ud-contact-title mb-12 lg:mb-[150px]">
                <span className="mb-6 block text-base font-medium text-dark dark:text-white">
                  CONTACT US
                </span>
                <h2 className="max-w-[260px] text-[35px] leading-[1.14] font-semibold text-dark dark:text-white">
                  Let&apos;s talk about your restaurant.
                </h2>
                <p className="mt-4 max-w-[300px] text-base text-body-color dark:text-dark-6">
                  Trial questions, pricing or onboarding — we reply within one business day.
                </p>
              </div>
              <div className="mb-12 flex flex-wrap justify-between lg:mb-0">
                <div className="mb-8 flex w-[330px] max-w-full">
                  <div className="mr-6 text-[32px] text-primary">
                    <svg width="29" height="35" viewBox="0 0 29 35" className="fill-current">
                      <path d="M14.5 0.710938C6.89844 0.710938 0.664062 6.72656 0.664062 14.0547C0.664062 19.9062 9.03125 29.5859 12.6406 33.5234C13.1328 34.0703 13.7891 34.3437 14.5 34.3437C15.2109 34.3437 15.8672 34.0703 16.3594 33.5234C19.9688 29.6406 28.3359 19.9062 28.3359 14.0547C28.3359 6.67188 22.1016 0.710938 14.5 0.710938ZM14.5 20.3984C11.2734 20.3984 8.59375 17.7734 8.59375 14.4922C8.59375 11.2109 11.2187 8.58594 14.5 8.58594C17.7812 8.58594 20.4062 11.2109 20.4062 14.4922C20.4062 17.7734 17.7266 20.3984 14.5 20.3984Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-[18px] text-lg font-semibold text-dark dark:text-white">
                      Our Location
                    </h3>
                    <p className="text-base text-body-color dark:text-dark-6">
                      Chennai, Tamil Nadu, India
                    </p>
                  </div>
                </div>
                <div className="mb-8 flex w-[330px] max-w-full">
                  <div className="mr-6 text-[32px] text-primary">
                    <svg width="34" height="25" viewBox="0 0 34 25" className="fill-current">
                      <path d="M30.5156 0.960938H3.17188C1.42188 0.960938 0 2.38281 0 4.13281V20.9219C0 22.6719 1.42188 24.0938 3.17188 24.0938H30.5156C32.2656 24.0938 33.6875 22.6719 33.6875 20.9219V4.13281C33.6875 2.38281 32.2656 0.960938 30.5156 0.960938ZM17.6094 11.3516C17.1172 11.625 16.5703 11.625 16.0781 11.3516L2.46094 3.09375C2.67969 2.98438 2.89844 2.875 3.17188 2.875H30.5156C30.7891 2.875 31.0078 2.92969 31.2266 3.09375L17.6094 11.3516ZM31.6641 20.8672C31.6641 21.5781 31.1719 22.125 30.5156 22.125H3.17188C2.51562 22.125 1.91406 21.5781 1.91406 20.8672V5.00781L15.0391 12.9922C15.5859 13.3203 16.1875 13.4844 16.7891 13.4844C17.3906 13.4844 17.9922 13.3203 18.5391 12.9922L31.6641 5.00781V20.8672Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-[18px] text-lg font-semibold text-dark dark:text-white">
                      How Can We Help?
                    </h3>
                    <p className="text-base text-body-color dark:text-dark-6">
                      hello@pixapos.store
                    </p>
                    <p className="mt-1 text-base text-body-color dark:text-dark-6">
                      Trial, pricing and onboarding
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full px-4 lg:w-5/12 xl:w-4/12">
            <div className="rounded-lg bg-white px-8 py-10 shadow-testimonial sm:px-10 sm:py-12 md:p-[60px] lg:p-10 lg:px-10 lg:py-12 2xl:p-[60px] dark:bg-dark-2 dark:shadow-none">
              <h3 className="mb-8 text-2xl font-semibold text-dark md:text-[28px] md:leading-[1.42] dark:text-white">
                Send us a Message
              </h3>
              <form onSubmit={send}>
                <div className="mb-[22px]">
                  <label
                    htmlFor="fullName"
                    className="mb-4 block text-sm text-body-color dark:text-dark-6"
                  >
                    Full Name*
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={inputCls}
                  />
                </div>
                <div className="mb-[22px]">
                  <label
                    htmlFor="email"
                    className="mb-4 block text-sm text-body-color dark:text-dark-6"
                  >
                    Email*
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    className={inputCls}
                  />
                </div>
                <div className="mb-[30px]">
                  <label
                    htmlFor="message"
                    className="mb-4 block text-sm text-body-color dark:text-dark-6"
                  >
                    Message*
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Outlets, registers, go-live date…"
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-md bg-primary px-7 py-3 text-base font-medium text-white duration-300 hover:bg-primary/90"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
