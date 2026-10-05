"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CatalogPlan = {
  id: string;
  name: string;
  tagline: string | null;
  monthlyPaise: number | null;
  annualDiscountPct: number;
  features: string[];
  outletLimit: number | null;
  sortOrder: number;
  isActive: boolean;
};

function inr(paise: number | null): string {
  if (paise === null) return "Custom";
  if (paise === 0) return "Free";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const emptyForm = {
  id: "",
  name: "",
  tagline: "",
  monthlyInr: "",
  annualDiscountPct: "20",
  features: "",
  outletLimit: "",
  sortOrder: "0",
};

export function PlansManager({ initialPlans }: { initialPlans: CatalogPlan[] }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) setError(data?.error ?? "save failed");
      else {
        setForm(emptyForm);
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("save failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: CatalogPlan) {
    setEditing(p.id);
    setForm({
      id: p.id,
      name: p.name,
      tagline: p.tagline ?? "",
      monthlyInr: p.monthlyPaise === null ? "" : String(p.monthlyPaise / 100),
      annualDiscountPct: String(p.annualDiscountPct),
      features: p.features.join("\n"),
      outletLimit: p.outletLimit === null ? "" : String(p.outletLimit),
      sortOrder: String(p.sortOrder),
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name.trim(),
      tagline: form.tagline.trim() || null,
      monthlyPaise:
        form.monthlyInr.trim() === "" ? null : Math.round(Number(form.monthlyInr) * 100),
      annualDiscountPct: Number(form.annualDiscountPct) || 0,
      features: form.features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      outletLimit: form.outletLimit.trim() === "" ? null : Number(form.outletLimit),
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (editing) void call(`/api/admin/plans/${editing}`, "PATCH", body);
    else void call("/api/admin/plans", "POST", { ...body, id: form.id.trim().toLowerCase() });
  }

  const input =
    "w-full rounded-lg border px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {initialPlans.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border bg-white p-5 ${p.isActive ? "" : "opacity-60"}`}
          >
            <div className="flex items-center gap-2">
              <p className="font-semibold">{p.name}</p>
              {!p.isActive && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium">
                  inactive
                </span>
              )}
            </div>
            <p className="mt-1 text-2xl font-semibold">{inr(p.monthlyPaise)}</p>
            {p.tagline && <p className="mt-1 text-sm text-zinc-500">{p.tagline}</p>}
            <ul className="mt-3 space-y-1 text-sm text-zinc-700">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-zinc-500">
              {p.outletLimit ? `≤ ${p.outletLimit} outlets` : "Unlimited outlets"} ·{" "}
              {p.annualDiscountPct}% annual off
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => startEdit(p)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
              >
                Edit
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void call(`/api/admin/plans/${p.id}`, "PATCH", { isActive: !p.isActive })
                }
                className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
              >
                {p.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5">
        <p className="font-semibold">{editing ? `Edit plan ${editing}` : "New plan"}</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {!editing && (
            <label className="text-xs text-zinc-600">
              ID (slug)
              <input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="growth-plus"
                required
                className={input}
              />
            </label>
          )}
          <label className="text-xs text-zinc-600">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={input}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Tagline
            <input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className={input}
            />
          </label>
          <label className="text-xs text-zinc-600">
            ₹/month (blank = custom)
            <input
              value={form.monthlyInr}
              onChange={(e) => setForm({ ...form, monthlyInr: e.target.value })}
              inputMode="decimal"
              placeholder="1999"
              className={input}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Annual discount %
            <input
              value={form.annualDiscountPct}
              onChange={(e) => setForm({ ...form, annualDiscountPct: e.target.value })}
              inputMode="numeric"
              className={input}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Outlet limit (blank = unlimited)
            <input
              value={form.outletLimit}
              onChange={(e) => setForm({ ...form, outletLimit: e.target.value })}
              inputMode="numeric"
              className={input}
            />
          </label>
        </div>
        <label className="mt-2 block text-xs text-zinc-600">
          Features (one per line)
          <textarea
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
            rows={4}
            className={input}
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : editing ? "Save plan" : "Create plan"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
