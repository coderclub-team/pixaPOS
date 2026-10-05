"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = { id: string; name: string; permissions: string[] };

export function RolesManager({
  initialRoles,
  vocabulary,
}: {
  initialRoles: Role[];
  vocabulary: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) setError(data?.error ?? "save failed");
      else {
        setName("");
        setChecked([]);
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("save failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(list: string[], p: string): string[] {
    return list.includes(p) ? list.filter((x) => x !== p) : [...list, p];
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {initialRoles.map((r) => (
          <li key={r.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{r.name}</p>
              <span className="text-xs text-zinc-500">{r.permissions.length} permissions</span>
              <span className="ml-auto flex gap-2">
                <button
                  onClick={() => {
                    setEditing(r);
                    setChecked(r.permissions);
                    setName(r.name);
                  }}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
                >
                  Edit
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(`Delete role "${r.name}"? Owners on it must be reassigned first.`)
                    ) {
                      void call(`/api/admin/roles/${r.id}`, "DELETE");
                    }
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">{r.permissions.join(", ") || "—"}</p>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (editing)
            void call(`/api/admin/roles/${editing.id}`, "PATCH", { name, permissions: checked });
          else void call("/api/admin/roles", "POST", { name, permissions: checked });
        }}
        className="rounded-xl border bg-white p-4"
      >
        <p className="font-semibold">{editing ? `Edit role` : "New role"}</p>
        <label className="mt-2 block text-xs text-zinc-600">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full max-w-xs rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-zinc-900"
          />
        </label>
        <div className="mt-3 grid gap-1 sm:grid-cols-2">
          {vocabulary.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked.includes(p)}
                onChange={() => setChecked((c) => toggle(c, p))}
              />
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{p}</code>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {editing ? "Save role" : "Create role"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setName("");
                setChecked([]);
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
