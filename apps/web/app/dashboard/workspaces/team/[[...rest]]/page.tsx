"use client";

import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { teamInfoContent } from "@/config/infoconfig";
import { baOrgs } from "@/lib/auth-client";
import { useIdentity } from "@/hooks/use-identity";
import { updateMemberRoleAction } from "@/features/rbac/actions";
import { toast } from "sonner";

type Member = { id: string; userId: string; role: string; user?: { name: string; email: string } };

const ROLES = ["admin", "manager", "cashier", "waiter", "kitchen", "accountant"];

export default function TeamPage() {
  const { organization } = useIdentity();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("cashier");
  const [pending, setPending] = useState(false);

  const refresh = async () => {
    if (!organization?.id) return;
    const res = await baOrgs.getFull(organization.id).catch(() => null);
    const list = ((res?.data as { members?: Member[] } | null)?.members ?? []).map((m) => ({
      ...m,
    }));
    setMembers(list);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    setPending(true);
    const res = await baOrgs.invite(organization.id, email.trim(), role).catch(() => null);
    if (!res) {
      toast.error("Invite failed");
      setPending(false);
      return;
    }
    toast.success(`Invited ${email.trim()} as ${role}`);
    setEmail("");
    setPending(false);
    await refresh();
  };

  const changeRole = async (userId: string, next: string) => {
    if (!organization?.id) return;
    const res = await updateMemberRoleAction(userId, next);
    if (!res.ok) toast.error(res.message);
    else {
      toast.success(res.message);
      await refresh();
    }
  };

  const remove = async (memberId: string, userId: string) => {
    if (!organization?.id) return;
    const res = await baOrgs.removeMember(organization.id, memberId).catch(() => null);
    if (!res) toast.error("Remove failed");
    else {
      toast.success("Member removed");
      await refresh();
    }
    void userId;
  };

  return (
    <PageContainer
      pageTitle="Team Management"
      pageDescription="Manage your workspace team, members and roles."
      infoContent={teamInfoContent}
    >
      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Members{organization ? ` — ${organization.name}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.user?.name ?? m.userId}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.user?.email ?? ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Select value={m.role} onValueChange={(v) => changeRole(m.userId, v)}>
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive"
                      onClick={() => remove(m.id, m.userId)}
                    >
                      Remove
                    </Button>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="inv-email">Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={pending || !email.trim()}>
                {pending ? "Inviting…" : "Invite"}
              </Button>
            </form>
            <p className="pt-2 text-[11px] text-muted-foreground">
              No mailer is wired yet — invited staff sign up with the same email, then an admin sets
              their role here.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
