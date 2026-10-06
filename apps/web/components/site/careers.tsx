"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-[#138AF2] focus:ring-2 focus:ring-[#138AF2]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export default function Careers() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "Sales Executive",
    experience: "",
    city: "",
    coverLetter: "",
  });
  const [resumeName, setResumeName] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = {
        ...form,
        source: "career",
        resumeName,
      };

      const res = await fetch("/api/careers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to submit your application right now.");
      }

      setSubmitted(true);
      setForm({
        fullName: "",
        email: "",
        phone: "",
        role: "Sales Executive",
        experience: "",
        city: "",
        coverLetter: "",
      });
      setResumeName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section id="careers" className="bg-slate-50 py-20 md:py-[120px] dark:bg-dark-2">
        <div className="container">
          <div className="mx-auto max-w-3xl rounded-[30px] border border-[#17BF71]/20 bg-white p-8 text-center shadow-[0_30px_80px_rgba(23,191,113,0.1)] dark:bg-dark">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#17BF71]/10 text-2xl text-[#17BF71]">
              ✓
            </div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#17BF71]">
              Application received
            </p>
            <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">
              Thanks for applying to pixaPOS.
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Our hiring team will review your profile and get in touch soon.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="careers" className="bg-slate-50 py-20 md:py-[120px] dark:bg-dark-2">
      <div className="container">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#138AF2]">
              Careers
            </p>
            <h2 className="mb-5 text-3xl font-bold text-slate-900 sm:text-[42px] sm:leading-[1.1] dark:text-white">
              Build the next generation of restaurant technology.
            </h2>
            <p className="mb-8 text-base leading-7 text-slate-600 dark:text-slate-300">
              We are hiring product, engineering, support, and restaurant operations specialists to
              help Indian businesses run faster, smarter, and more profitably.
            </p>

            <div className="space-y-4">
              {[
                "PWA-first product teams for web, tablet and mobile workflows",
                "Multi-outlet operations and enterprise restaurant automation",
                "Customer success for India’s most demanding food businesses",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
                >
                  <span className="mt-1 inline-flex size-6 items-center justify-center rounded-full bg-[#17BF71]/10 text-[#17BF71]">
                    ✓
                  </span>
                  <p className="text-slate-700 dark:text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-dark">
            <h3 className="mb-5 text-2xl font-bold text-slate-900 dark:text-white">Apply now</h3>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Full name
                  </label>
                  <input
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    className={inputClass}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Role interested in
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                    className={inputClass}
                  >
                    <option>Sales Executive</option>
                    <option>Product Specialist</option>
                    <option>Implementation Engineer</option>
                    <option>Customer Success Manager</option>
                    <option>Operations Manager</option>
                    <option>Developer</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className={inputClass}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Experience
                  </label>
                  <input
                    value={form.experience}
                    onChange={(e) => setForm((prev) => ({ ...prev, experience: e.target.value }))}
                    className={inputClass}
                    placeholder="3 years in restaurant tech"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    City
                  </label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    className={inputClass}
                    placeholder="Chennai, Bengaluru, etc."
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Upload resume
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeName(e.target.files?.[0]?.name || "")}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#138AF2] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                />
                {resumeName ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Selected: {resumeName}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Short note
                </label>
                <textarea
                  rows={4}
                  value={form.coverLetter}
                  onChange={(e) => setForm((prev) => ({ ...prev, coverLetter: e.target.value }))}
                  className={inputClass}
                  placeholder="Tell us why you want to join pixaPOS and what you can bring to restaurant teams."
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-[#F24949]/20 bg-[#F24949]/5 px-3 py-2 text-sm text-[#A81E1E]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#138AF2] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#0b75d9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting…" : "Apply now"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
