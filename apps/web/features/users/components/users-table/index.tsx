"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { usersQueryOptions } from "../../api/queries";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { POS_ROLES } from "@/config/roles";
import { CellAction } from "./cell-action";

function roleLabel(value: string) {
  return POS_ROLES.find((r) => r.value === value)?.label ?? value;
}

export function UsersTable() {
  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(10),
      name: parseAsString,
      role: parseAsString,
    },
    { shallow: true },
  );

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.name && { search: params.name }),
    ...(params.role && { roles: params.role }),
  };

  const { data } = useSuspenseQuery(usersQueryOptions(filters));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search users..."
            value={params.name ?? ""}
            onChange={(e) => setParams({ name: e.target.value || null, page: 1 })}
            className="max-w-sm"
          />
          <Select
            value={params.role ?? "all"}
            onValueChange={(v) => setParams({ role: v === "all" ? null : v, page: 1 })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {POS_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            {data.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {user.first_name} {user.last_name}
                    </span>
                    <span className="text-muted-foreground text-xs">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>
                  <Badge variant="outline">{roleLabel(user.role)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      user.status === "Active"
                        ? "default"
                        : user.status === "Inactive"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <CellAction data={user} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {data.users.length} of {data.total_users} users
          </span>
          <span>
            Page {params.page} •{" "}
            {data.total_users > 0 ? Math.ceil(data.total_users / params.perPage) : 1} pages
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-4">
      <div className="bg-muted h-10 w-full rounded" />
      <div className="bg-muted h-96 w-full rounded-lg" />
      <div className="bg-muted h-10 w-full rounded" />
    </div>
  );
}
