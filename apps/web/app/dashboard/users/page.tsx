"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { UserList } from "@/features/users/components/user-list";
import { usersQueryOptions } from "@/features/users/api/queries";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { POS_ROLES } from "@/config/roles";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";

export default function UsersPage() {
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");

  const { data, isPending } = useQuery(
    usersQueryOptions({
      search: search || undefined,
      roles: role,
      // TODO(scroll-pagination): replace with useInfiniteQuery + sentinel row.
      limit: 500,
    }),
  );

  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  if (isPending) {
    return (
      <PageContainer pageTitle="Users" pageDescription="Sales — Users" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Users"
      pageDescription="Manage restaurant staff with POS roles (Owner, Manager, Cashier, Waiter, Kitchen, Accountant). Roles control floors/tables/orders access."
      pageHeaderAction={
        <Link href="/dashboard/users/new" className={cn(buttonVariants(), "text-xs md:text-sm")}>
          <Icons.add className="mr-2 h-4 w-4" /> Add New
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search users by name, phone or email..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select value={role ?? "all"} onValueChange={(v) => setRole(v === "all" ? undefined : v)}>
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

      <UserList users={data?.users ?? []} />
    </PageContainer>
  );
}
