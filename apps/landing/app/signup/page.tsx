"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { APP_URL } from "@/lib/site";
import { TRIAL_DAYS } from "@/lib/plans";

const TYPES = [
  "Quick-service (QSR)",
  "Dine-in restaurant",
  "Cloud kitchen",
  "Café",
  "Bakery / Sweet shop",
  "Food court stall",
  "Other",
];

const SOURCES = [
  "YouTube",
  "Instagram",
  "Website / Google search",
  "Referral",
  "Field sales",
  "Other",
];

const OUTLETS = ["1", "2–5", "6–20", "20+"];

const inputCls =
  "w-full rounded-md border border-stroke bg-transparent px-5 py-3 text-base text-dark outline-none placeholder:text-body-color/70 focus:border-primary focus-visible:shadow-none dark:border-dark-3 dark:text-white";
const labelCls = "mb-4 block text-sm text-body-color dark:text-dark-6";

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "";

  const [form, setForm] = useState({
    restaurant: "",
    type: "",
    address: "",
    lat: "",
    lng: "",
    source: "",
    mobile: "",
    email: "",
    outlets: "1",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErrors((er) => ({ ...er, [k]: "" }));
    };

  const useLocation = () => {
    if (!("geolocation" in navigator)) {
      setErrors((er) => ({ ...er, address: "Geolocation not supported on this device" }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
      },
      () => {
        setLocating(false);
        setErrors((er) => ({
          ...er,
          address: "Couldn't read location — type the address instead",
        }));
      },
      { timeout: 10000 },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.restaurant.trim()) er.restaurant = "Restaurant name is required";
    if (!form.type) er.type = "Pick a restaurant type";
    if (!form.address.trim()) er.address = "Address is required";
    if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/[\s-]/g, "")))
      er.mobile = "Enter a valid 10-digit mobile number";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) er.email = "Enter a valid email";
    if (!form.source) er.source = "Tell us where you heard about us";
    setErrors(er);
    if (Object.keys(er).length > 0) return;

    const params = new URLSearchParams({
      trial: "14d",
      name: form.restaurant.trim(),
      email: form.email.trim(),
      phone: form.mobile.replace(/[\s-]/g, ""),
      outlets: form.outlets,
    });
    if (plan) params.set("plan", plan);
    window.location.href = `${APP_URL}/auth/sign-up?${params.toString()}`;
  };

  const err = (k: string) =>
    errors[k] ? <p className="mt-1 text-xs text-red-500">{errors[k]}</p> : null;

  return (
    <section className="relative py-20 md:py-[120px]">
      <div className="absolute top-0 left-0 -z-[1] h-full w-full dark:bg-dark" />
      <div className="absolute top-0 left-0 -z-[1] h-1/2 w-full bg-[#E9F9FF] lg:h-[45%] xl:h-1/2 dark:bg-dark-700" />
      <div className="container px-4">
        <div className="-mx-4 flex flex-wrap justify-center">
          <div className="w-full px-4 lg:w-7/12 xl:w-6/12">
            <div className="rounded-lg bg-white px-8 py-10 shadow-testimonial sm:px-10 sm:py-12 md:p-[60px] lg:p-10 lg:px-10 lg:py-12 2xl:p-[60px] dark:bg-dark-2 dark:shadow-none">
              <span className="mb-4 inline-block rounded bg-primary px-4 py-1 text-xs font-semibold text-white">
                {TRIAL_DAYS}-day free trial · No credit card
                {plan ? ` · ${plan}` : ""}
              </span>
              <h1 className="mb-3 text-2xl font-semibold text-dark md:text-[28px] md:leading-[1.42] dark:text-white">
                Register your restaurant
              </h1>
              <p className="mb-8 text-base text-body-color dark:text-dark-6">
                Tell us about your outlet — we&apos;ll open your trial account with everything
                pre-filled.
              </p>
              <form onSubmit={submit} noValidate>
                <div className="mb-[22px]">
                  <label htmlFor="restaurant" className={labelCls}>
                    Restaurant name*
                  </label>
                  <input
                    id="restaurant"
                    type="text"
                    value={form.restaurant}
                    onChange={set("restaurant")}
                    placeholder="e.g. Annapoorani Bhavan"
                    className={inputCls}
                  />
                  {err("restaurant")}
                </div>

                <div className="-mx-2 flex flex-wrap">
                  <div className="mb-[22px] w-full px-2 sm:w-1/2">
                    <label htmlFor="type" className={labelCls}>
                      Restaurant type*
                    </label>
                    <select id="type" value={form.type} onChange={set("type")} className={inputCls}>
                      <option value="">Select type</option>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {err("type")}
                  </div>
                  <div className="mb-[22px] w-full px-2 sm:w-1/2">
                    <label htmlFor="outlets" className={labelCls}>
                      Number of outlets*
                    </label>
                    <select
                      id="outlets"
                      value={form.outlets}
                      onChange={set("outlets")}
                      className={inputCls}
                    >
                      {OUTLETS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-[22px]">
                  <div className="mb-4 flex items-center justify-between">
                    <label htmlFor="address" className="text-sm text-body-color dark:text-dark-6">
                      Outlet address*
                    </label>
                    <button
                      type="button"
                      onClick={useLocation}
                      disabled={locating}
                      className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
                    >
                      {locating
                        ? "Reading location…"
                        : form.lat
                          ? `📍 ${form.lat}, ${form.lng}`
                          : "Use my location (optional)"}
                    </button>
                  </div>
                  <textarea
                    id="address"
                    rows={3}
                    value={form.address}
                    onChange={set("address")}
                    placeholder="Shop no, street, area, city, state, PIN"
                    className={inputCls}
                  />
                  {err("address")}
                </div>

                <div className="-mx-2 flex flex-wrap">
                  <div className="mb-[22px] w-full px-2 sm:w-1/2">
                    <label htmlFor="mobile" className={labelCls}>
                      Mobile number*
                    </label>
                    <input
                      id="mobile"
                      type="tel"
                      inputMode="numeric"
                      value={form.mobile}
                      onChange={set("mobile")}
                      placeholder="10-digit mobile"
                      className={inputCls}
                    />
                    {err("mobile")}
                  </div>
                  <div className="mb-[22px] w-full px-2 sm:w-1/2">
                    <label htmlFor="email" className={labelCls}>
                      Email*
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@restaurant.com"
                      className={inputCls}
                    />
                    {err("email")}
                  </div>
                </div>

                <div className="mb-[30px]">
                  <label htmlFor="source" className={labelCls}>
                    Where did you hear about us?*
                  </label>
                  <select
                    id="source"
                    value={form.source}
                    onChange={set("source")}
                    className={inputCls}
                  >
                    <option value="">Select one</option>
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {err("source")}
                </div>

                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-md bg-primary px-7 py-3 text-base font-medium text-white duration-300 hover:bg-primary/90"
                >
                  Create trial account
                </button>
                <p className="mt-4 text-center text-xs text-body-color dark:text-dark-6">
                  Already registered?{" "}
                  <Link href={`${APP_URL}/auth/sign-in`} className="text-primary hover:underline">
                    Log in to the app
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm">Loading…</p>}>
      <SignupForm />
    </Suspense>
  );
}
