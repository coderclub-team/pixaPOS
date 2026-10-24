"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { Skeleton } from "@pixa/ui/base-ui/skeleton";
import { outletKeys } from "@/features/outlet/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { useIdentity } from "@/hooks/use-identity";

type ScopedOutlet = { id: string; name: string; code: string; organizationId?: string };

/**
 * Outlet picker for bare terminal routes (/pos, /kds …). Staff mode lists
 * the caller's accessible outlets; public mode (kiosk/qr) takes a code.
 * Selecting or creating navigates to `${basePath}/${code}` — the slug
 * route then owns outlet context server-side.
 */
export function EnsureOutletDialog({
  basePath,
  mode,
}: {
  basePath: string;
  mode: "list" | "code";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [goCode, setGoCode] = useState("");

  const { data: scoped, isPending } = useQuery({
    queryKey: ["me", "outlets", "picker"],
    queryFn: async (): Promise<{ outlets?: ScopedOutlet[] }> => {
      try {
        const res = await fetch("/api/me/outlets", { credentials: "include" });
        if (!res.ok) return {};
        return (await res.json()) as { outlets?: ScopedOutlet[] };
      } catch {
        return {};
      }
    },
    staleTime: 60_000,
    enabled: mode === "list",
  });
  const list = scoped?.outlets ?? [];

  const { organization } = useIdentity();
  const orgId = organization?.id ?? null;
  const go = (outletCode: string) => {
    const slug = outletCode.trim().toUpperCase();
    if (!slug) return;
    router.push(`${basePath}/${encodeURIComponent(slug)}`);
  };
  const goById = (outletId: string, outletOrgId?: string) => {
    const oid = outletOrgId ?? orgId;
    if (oid && outletId) {
      // canonical: /o/[orgId]/outlet/[outletId]/pos etc. — derive surface from basePath
      const surface = basePath.replace(/^\//, "");
      router.push(`/o/${oid}/outlet/${outletId}/${surface}`);
      return;
    }
    // fallback to legacy code path
    const found = list.find((o) => o.id === outletId);
    if (found) go(found.code);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined }),
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create outlet");
      return data;
    },
    onSuccess: (data: { code?: string; id?: string; organization_id?: string }) => {
      getQueryClient().invalidateQueries({ queryKey: outletKeys.list() });
      toast.success(`Outlet ${data.code} created`);
      setName("");
      setCode("");
      if (data.id) goById(data.id, (data as { organization_id?: string }).organization_id ?? orgId ?? undefined);
      else if (data.code) go(data.code);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Select an outlet</DialogTitle>
          <DialogDescription>
            {mode === "list"
              ? "Pick an outlet to continue, or create a new one."
              : "Enter your outlet code to continue."}
          </DialogDescription>
        </DialogHeader>
        {mode === "list" ? (
          <>
            {isPending ? (
              <div className="grid gap-2 py-2" role="status" aria-label="Loading outlets">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ) : list.length > 0 ? (
              <div className="max-h-[40dvh] space-y-1 overflow-y-auto">
                {list.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => goById(o.id, (o as ScopedOutlet & { organizationId?: string }).organizationId ?? orgId ?? undefined)}
                    className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors"
                  >
                    <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                      {o.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                    <span className="text-muted-foreground truncate text-[11px]">{o.id.slice(0, 8)}…</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-2 text-center text-sm">
                No outlets assigned to you yet — create one below.
              </p>
            )}
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">New outlet name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Main Branch"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Code (optional — auto)</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="MAIN"
                  maxLength={12}
                />
              </div>
              <Button
                className="w-full"
                disabled={createMut.isPending || name.trim().length < 2}
                onClick={() => createMut.mutate()}
              >
                <Icons.add className="mr-1 size-4" />
                {createMut.isPending ? "Creating…" : "Create outlet"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Outlet code *</Label>
              <Input
                value={goCode}
                onChange={(e) => setGoCode(e.target.value.toUpperCase())}
                placeholder="MAIN"
                maxLength={12}
                onKeyDown={(e) => {
                  if (e.key === "Enter") go(goCode);
                }}
              />
            </div>
            <Button
              className="w-full"
              disabled={goCode.trim().length < 1}
              onClick={() => go(goCode)}
            >
              Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
