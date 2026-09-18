"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const { organization, setActiveOrg } = useIdentity();
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
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const created = await baOrgs.create(name.trim(), slug).catch(() => null);
    if (!created?.data) {
      toast.error("Could not create workspace");
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
                  placeholder="Downtown outlet"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button disabled={pending || !name.trim()}>
                <Icons.add className="mr-1 size-4" /> Create
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
