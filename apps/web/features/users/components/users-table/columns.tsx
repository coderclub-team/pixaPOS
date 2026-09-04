"use client";
import { Badge } from "@pixa/ui/base-ui/badge";
import type { User } from "../../api/types";
import { POS_ROLES } from "@/config/roles";

function roleLabel(value: string) {
  return POS_ROLES.find((r) => r.value === value)?.label ?? value;
}

export const columns = [
  {
    id: "name",
    accessorFn: (row: User) => `${row.first_name} ${row.last_name}`,
    header: "Name",
    cell: (row: User) => `${row.first_name} ${row.last_name}`,
    meta: { label: "Name", placeholder: "Search users...", variant: "text" as const },
    enableColumnFilter: true,
  },
  {
    accessorKey: "phone",
    header: "PHONE",
  },
  {
    id: "role",
    accessorKey: "role",
    header: "Role",
    cell: (value: string) => roleLabel(value),
    enableColumnFilter: true,
    meta: { label: "roles", variant: "multiSelect" as const, options: [] },
  },
  {
    accessorKey: "status",
    header: "STATUS",
    cell: (value: string) => value,
  },
  {
    id: "actions",
    header: "Actions",
  },
] as const;
