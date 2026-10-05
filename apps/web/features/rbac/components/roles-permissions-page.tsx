"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Checkbox } from "@pixa/ui/base-ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@pixa/ui/base-ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { POS_PERMISSION_META } from "@/config/permissions";
import {
  setRolePermissionAction,
  syncPosPermissionsAction,
  updateMemberRoleAction,
} from "../actions";
import type { OrgMember, RolesPermissionsData } from "../api/types";
import { SortTh, useSorting } from "@/components/sort-th";

function displayName(member: OrgMember) {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
  return name || member.email || member.userId;
}

function initials(member: OrgMember) {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
  const source = name || member.email || "?";
  return source.slice(0, 2).toUpperCase();
}

export function RolesPermissionsPage({ data }: { data: RolesPermissionsData }) {
  const router = useRouter();
  const { members, roles, permissions } = data;
  const [isSyncing, startSync] = React.useTransition();
  const [busyCell, setBusyCell] = React.useState<string | null>(null);
  const [busyMember, setBusyMember] = React.useState<string | null>(null);

  const {
    sortKey: memberSortKey,
    sortDir: memberSortDir,
    toggle: toggleMember,
    sorted: sortMembers,
  } = useSorting<OrgMember>("name");
  const sortedMembers = sortMembers(members, {
    name: (m) => displayName(m),
    role: (m) => m.role,
    permissions: (m) => m.permissions.length,
  });

  const {
    sortKey: permSortKey,
    sortDir: permSortDir,
    toggle: togglePerm,
    sorted: sortPermissions,
  } = useSorting<{ id: string; name: string; key: string }>("name");
  const sortedPermissions = sortPermissions(permissions, {
    name: (p) => p.name || p.key,
    key: (p) => p.key,
  });

  const missingPermissions = React.useMemo(
    () => POS_PERMISSION_META.filter((p) => !permissions.some((e) => e.key === p.key)),
    [permissions],
  );

  const onRoleChange = (member: OrgMember, role: string) => {
    setBusyMember(member.userId);
    void updateMemberRoleAction(member.userId, role).then((res) => {
      setBusyMember(null);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const onTogglePermission = (roleId: string, permissionId: string, assigned: boolean) => {
    const key = `${roleId}:${permissionId}`;
    setBusyCell(key);
    void setRolePermissionAction(roleId, permissionId, assigned).then((res) => {
      setBusyCell(null);
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const onSync = () => {
    startSync(() => {
      void syncPosPermissionsAction().then((res) => {
        if (res.ok) toast.success(res.message);
        else toast.error(res.message);
        router.refresh();
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="font-mono text-lg font-medium">{members.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Roles</p>
            <p className="font-mono text-lg font-medium">{roles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Permissions</p>
            <p className="font-mono text-lg font-medium">{permissions.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortTh
                    label="Member"
                    column="name"
                    sortKey={memberSortKey}
                    sortDir={memberSortDir}
                    onToggle={toggleMember}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Role"
                    column="role"
                    sortKey={memberSortKey}
                    sortDir={memberSortDir}
                    onToggle={toggleMember}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Effective permissions"
                    column="permissions"
                    sortKey={memberSortKey}
                    sortDir={memberSortDir}
                    onToggle={toggleMember}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.imageUrl} alt={displayName(member)} />
                        <AvatarFallback>{initials(member)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{displayName(member)}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onValueChange={(v) => onRoleChange(member, v)}
                      disabled={busyMember === member.userId}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.key}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.permissions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        member.permissions.slice(0, 6).map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-[10px]">
                            {perm}
                          </Badge>
                        ))
                      )}
                      {member.permissions.length > 6 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{member.permissions.length - 6}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    No members in this organization.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Roles &amp; Permissions</CardTitle>
            <p className="text-xs text-muted-foreground">
              Toggle a permission on a role. Changes apply to every member with that role.
            </p>
          </div>
          {missingPermissions.length > 0 && (
            <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing}>
              <Icons.sparkles className="mr-2 h-4 w-4" />
              {isSyncing ? "Creating…" : `Create ${missingPermissions.length} POS permissions`}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">
                    <SortTh
                      label="Permission"
                      column="name"
                      sortKey={permSortKey}
                      sortDir={permSortDir}
                      onToggle={togglePerm}
                    />
                  </TableHead>
                  {roles.map((role) => (
                    <TableHead key={role.id} className="text-center">
                      {role.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <p className="font-medium">{permission.name || permission.key}</p>
                      <p className="font-mono text-xs text-muted-foreground">{permission.key}</p>
                    </TableCell>
                    {roles.map((role) => {
                      const assigned = role.permissionIds.includes(permission.id);
                      const cellKey = `${role.id}:${permission.id}`;
                      return (
                        <TableCell key={role.id} className="text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={assigned}
                              disabled={busyCell === cellKey}
                              onCheckedChange={(checked) =>
                                onTogglePermission(role.id, permission.id, checked === true)
                              }
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {sortedPermissions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={roles.length + 1}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No permissions defined yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {missingPermissions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {missingPermissions.length} POS permission{missingPermissions.length === 1 ? "" : "s"}{" "}
          used by this app {missingPermissions.length === 1 ? "does" : "do"} not exist in the
          organization roles yet:
          <span className="ml-1 font-mono">
            {missingPermissions
              .slice(0, 4)
              .map((p) => p.key)
              .join(", ")}
            {missingPermissions.length > 4 ? ` +${missingPermissions.length - 4}` : ""}
          </span>
        </p>
      )}
    </div>
  );
}
