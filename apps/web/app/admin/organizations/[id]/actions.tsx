"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrgActions({
  id,
  profile,
}: {
  id: string;
  profile: { lifecycle: string | null; plan: string | null } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(profile?.plan ?? "starter");
  const [lifecycle, setLifecycle] = useState(profile?.lifecycle ?? "trial");

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (!res.ok) alert("Save failed");
    else router.refresh();
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
          {["starter", "growth", "enterprise"].map((p) => (
            <option key={p} value={p}>
              {p}
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
      <button
        disabled={busy}
        onClick={() => save({ isBlocked: true, lifecycle: "suspended" })}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Suspend
      </button>
    </div>
  );
}
