"use client";

import type { User } from "../api/types";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { POS_ROLES } from "@/config/roles";
import { CellAction } from "./users-table/cell-action";

function roleLabel(value: string) {
  return POS_ROLES.find((r) => r.value === value)?.label ?? value;
}

interface UserListProps {
  users: User[];
}

export function UserList({ users }: UserListProps) {
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <div className="rounded-full border border-dashed p-3">
              <Icons.teams className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No users yet</p>
            <p className="text-sm text-muted-foreground">
              Add restaurant staff with POS roles to control floors, tables and orders access.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {user.first_name} {user.last_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{user.phone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {roleLabel(user.role)}
                </TableCell>
                <TableCell>
                  <StatusDot isActive={user.status === "Active"} inactiveLabel={user.status} />
                </TableCell>
                <TableCell className="text-right">
                  <CellAction data={user} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
