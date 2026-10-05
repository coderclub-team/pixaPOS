"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeadActions({ lead }: { lead: { id: string; status: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const call = async (url: string, init?: RequestInit) => {
    setBusy(true);
    const res = await fetch(url, init);
    setBusy(false);
    if (!res.ok) alert("Action failed");
    else router.refresh();
  };
  if (lead.status === "converted")
    return <p className="mt-3 text-xs text-emerald-700">✓ Converted to organisation</p>;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        disabled={busy}
        onClick={() =>
          call(`/api/admin/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "contacted" }),
          })
        }
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50"
      >
        Mark contacted
      </button>
      <button
        disabled={busy}
        onClick={() =>
          call(`/api/admin/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "trial" }),
          })
        }
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50"
      >
        Start trial
      </button>
      <button
        disabled={busy}
        onClick={() => call(`/api/admin/leads/${lead.id}/approve`, { method: "POST" })}
        className="rounded-lg bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white"
      >
        Approve → create org
      </button>
      <button
        disabled={busy}
        onClick={() =>
          call(`/api/admin/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "rejected" }),
          })
        }
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
      >
        Reject
      </button>
    </div>
  );
}
