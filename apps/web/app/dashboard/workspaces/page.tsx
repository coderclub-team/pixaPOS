"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Icons } from "@pixa/ui/icons";
import { workspacesInfoContent } from "@/config/infoconfig";
import { baOrgs } from "@/lib/auth-client";
import { useIdentity } from "@/hooks/use-identity";
import { toast } from "sonner";

type Org = { id: string; name: string; slug?: string | null; createdAt?: string };

export default function WorkspacesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, setActiveOrg } = useIdentity();
  const firstRun = searchParams.get("first") === "1";
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  const refresh = async () => {
    const res = await baOrgs.list().catch(() => null);
    setOrgs(((res?.data ?? []) as Org[]).map((o) => ({ ...o })));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    // Slug is globally unique: retry with a numeric suffix so a taken slug
    // (e.g. recreating a deleted workspace) surfaces as success, not a 400.
    // The server's message is shown verbatim for anything else.
    let created: { data: Org | null; error: { message?: string } | null } | null = null;
    let lastError = "Could not create workspace";
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      created = await baOrgs.create(name.trim(), slug).catch((err: unknown) => ({
        data: null,
        error: { message: err instanceof Error ? err.message : lastError },
      }));
      if (created?.data) break;
      lastError = created?.error?.message ?? lastError;
      if (!/slug|taken|exists|unique|duplicate/i.test(lastError)) break;
    }
    if (!created?.data) {
      toast.error(lastError);
      setPending(false);
      return;
    }
    toast.success(`Workspace "${name.trim()}" created`);
    setName("");
    setPending(false);
    await refresh();
  };

  const select = async (id: string) => {
    await setActiveOrg(id);
    router.push("/dashboard/workspaces/team");
    router.refresh();
  };

  return (
    <PageContainer
      pageTitle="Workspaces"
      pageDescription="Manage your workspaces and switch between them"
      infoContent={workspacesInfoContent}
    >
      <div className="grid max-w-2xl gap-4">
        {firstRun && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 text-sm">
              <p className="font-medium">Welcome — one step left.</p>
              <p className="text-muted-foreground">
                Create your business workspace below (e.g. Yummy Roast). Branches like Erode or
                Salem come later as outlets under it — never as new workspaces. Your full sidebar
                (sales, menu, inventory, tables…) unlocks as soon as it exists.
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="space-y-2 p-4">
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No workspaces yet — create your first one below.
              </p>
            ) : (
              orgs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => select(o.id)}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                >
                  <span>
                    <span className="block font-medium">{o.name}</span>
                    <span className="block text-xs text-muted-foreground">{o.slug}</span>
                  </span>
                  {organization?.id === o.id ? (
                    <span className="text-xs font-medium text-primary">Active</span>
                  ) : (
                    <Icons.chevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <form onSubmit={create} className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="ws-name">New workspace</Label>
                <Input
                  id="ws-name"
                  placeholder="Yummy Roast"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending || !name.trim()}>
                <Icons.add className="mr-1 size-4" /> Create
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
