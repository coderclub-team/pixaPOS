"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrgActions({
  id,
  profile,
  plans,
}: {
  id: string;
  profile: { lifecycle: string | null; plan: string | null } | null;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(profile?.plan ?? "starter");
  const [lifecycle, setLifecycle] = useState(profile?.lifecycle ?? "trial");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSuspend, setShowSuspend] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(data?.error ?? "Save failed");
    } else {
      setShowSuspend(false);
      setConfirmPassword("");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-zinc-600">
        Lifecycle{" "}
        <select
          value={lifecycle}
          onChange={(e) => setLifecycle(e.target.value)}
          className="rounded-lg border px-2 py-1.5 text-sm text-zinc-900"
        >
          {["trial", "active", "past_due", "suspended", "churned"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        Plan{" "}
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="rounded-lg border px-2 py-1.5 text-sm text-zinc-900"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() => save({ lifecycle, plan })}
        className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {!showSuspend ? (
        <button
          disabled={busy}
          onClick={() => setShowSuspend(true)}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Suspend
        </button>
      ) : (
        <span className="flex items-center gap-2 rounded-lg border border-red-200 px-2 py-1">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Your password to confirm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-sm outline-none"
          />
          <button
            disabled={busy || !confirmPassword}
            onClick={() => save({ isBlocked: true, lifecycle: "suspended", confirmPassword })}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirm suspend
          </button>
          <button
            onClick={() => {
              setShowSuspend(false);
              setConfirmPassword("");
            }}
            className="px-2 text-sm text-zinc-600"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
