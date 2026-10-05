"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Owner = {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  isActive: boolean;
};

export function OwnerActions({
  owners,
  roles,
}: {
  owners: Owner[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
        setEmail("");
        setPassword("");
        setRoleId("");
        setConfirmFor(null);
        setConfirmPassword("");
        setNewPassword("");
        router.refresh();
      }
    } catch {
      setError("save failed");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "rounded-lg border px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900";

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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void call("/api/admin/owners", "POST", {
            email,
            password,
            roleId: roleId || null,
          });
        }}
        className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-4"
      >
        <label className="text-xs text-zinc-600">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </label>
        <label className="text-xs text-zinc-600">
          Password (12+ chars)
          <input
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
        </label>
        <label className="text-xs text-zinc-600">
          Role
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={input}>
            <option value="">Staff (no role)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Invite staff
        </button>
      </form>

      <ul className="space-y-2">
        {owners.map((o) => (
          <li
            key={o.id}
            className={`rounded-xl border bg-white p-4 ${o.isActive ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{o.email}</p>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium">
                {o.role === "super_owner" ? "super owner" : "staff"}
              </span>
              {!o.isActive && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  deactivated
                </span>
              )}
              {o.role !== "super_owner" && (
                <>
                  <select
                    value={o.roleId ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      void call(`/api/admin/owners/${o.id}`, "PATCH", {
                        roleId: e.target.value || null,
                      })
                    }
                    className="ml-auto rounded-lg border px-2 py-1.5 text-xs"
                    aria-label={`Role for ${o.email}`}
                  >
                    <option value="">Staff (no role)</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={busy}
                    onClick={() =>
                      o.isActive
                        ? setConfirmFor(o.id)
                        : void call(`/api/admin/owners/${o.id}`, "PATCH", { isActive: true })
                    }
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {o.isActive ? "Deactivate" : "Activate"}
                  </button>
                </>
              )}
            </div>
            {o.role !== "super_owner" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {confirmFor === o.id ? (
                  <>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Your password to confirm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${input} w-56`}
                    />
                    <input
                      type="password"
                      placeholder="New password for them (12+)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${input} w-56`}
                    />
                    <button
                      disabled={busy || !confirmPassword || newPassword.length < 12}
                      onClick={() =>
                        void call(`/api/admin/owners/${o.id}`, "PATCH", {
                          password: newPassword,
                          confirmPassword,
                        })
                      }
                      className="rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => setConfirmFor(null)}
                      className="px-2 text-xs text-zinc-600"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={busy || !confirmPassword}
                      onClick={() =>
                        void call(`/api/admin/owners/${o.id}`, "PATCH", {
                          isActive: false,
                          confirmPassword,
                        })
                      }
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                    >
                      Confirm deactivate
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmFor(o.id)}
                    className="text-xs text-zinc-600 underline"
                  >
                    Password reset / deactivate…
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
