"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { authClient } from "@/lib/auth-client";
import { useIdentity } from "@/hooks/use-identity";
import { toast } from "sonner";

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useIdentity();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const { error } = await authClient.changePassword(
      { currentPassword, newPassword, revokeOtherSessions: true },
      { onError: () => setPending(false) },
    );
    if (error) {
      toast.error(error.message ?? "Password change failed");
      setPending(false);
      return;
    }
    toast.success("Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setPending(false);
  };

  return (
    <PageContainer
      pageTitle="Profile"
      pageDescription="Your personal account — name, email, password and sessions."
    >
      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cur">Current password</Label>
                <Input
                  id="cur"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">New password</Label>
                <Input
                  id="new"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
            </form>
          </CardContent>
        </Card>
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            router.push("/auth/sign-in");
          }}
        >
          Sign out
        </Button>
      </div>
    </PageContainer>
  );
}
