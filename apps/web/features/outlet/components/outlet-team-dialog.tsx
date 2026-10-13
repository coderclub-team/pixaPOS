"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { getQueryClient } from "@/lib/query-client";

type OrgMember = {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  outlet_ids: string[];
};

export function OutletTeamDialog({
  outletId,
  outletName,
  onClose,
}: {
  outletId: string;
  outletName: string;
  onClose: () => void;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["org", "members"],
    queryFn: async (): Promise<{ members: OrgMember[] }> => {
      const res = await fetch("/api/org/members", { credentials: "include" });
      if (!res.ok) return { members: [] };
      return (await res.json()) as { members: OrgMember[] };
    },
    staleTime: 30_000,
  });
  const [saving, setSaving] = useState<string | null>(null);
  const members = data?.members ?? [];

  const toggle = async (m: OrgMember) => {
    const assigned = m.outlet_ids.includes(outletId);
    setSaving(m.user_id);
    try {
      const res = await fetch(`/api/outlets/${encodeURIComponent(outletId)}/members`, {
        method: assigned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: m.user_id }),
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Failed to update assignment");
      }
      getQueryClient().invalidateQueries({ queryKey: ["org", "members"] });
      toast.success(assigned ? `Removed from ${outletName}` : `Assigned to ${outletName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update assignment");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Team — {outletName}</DialogTitle>
          <DialogDescription>
            Assign organization members to this outlet. A user may belong to several outlets; their
            role stays org-wide and decides which surfaces (POS, KDS…) they can open.
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No organization members found.
          </p>
        ) : (
          <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
            {members.map((m) => {
              const assigned = m.outlet_ids.includes(outletId);
              return (
                <label
                  key={m.user_id}
                  className="hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    disabled={saving === m.user_id}
                    onChange={() => toggle(m)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {m.name || m.email || m.user_id}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {[m.role, m.email].filter(Boolean).join(" · ")}
                      {m.outlet_ids.length > 0 ? ` · ${m.outlet_ids.length} outlet(s)` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
