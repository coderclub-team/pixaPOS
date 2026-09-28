"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PageContainer from "@/components/layout/page-container";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Button, buttonVariants } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { formatINR } from "@/lib/money";
import { SortTh, useSorting } from "@/components/sort-th";
import { ExportButton } from "@/features/system/components/io-dialog";
import type { CsvColumn } from "@/features/system/lib/csv";
import { promosQueryOptions } from "@/features/promos/api/queries";
import type { PromoCode } from "@/features/promos/api/types";

const columns: CsvColumn<PromoCode>[] = [
  { key: "code", label: "Code", get: (p) => p.code },
  { key: "name", label: "Name", get: (p) => p.name },
  { key: "kind", label: "Type", get: (p) => p.kind },
  {
    key: "value",
    label: "Value",
    get: (p) => (p.kind === "percent" ? `${p.value}%` : `Rs.${p.value / 100}`),
  },
  { key: "scope", label: "Scope", get: (p) => p.scope },
  {
    key: "channels",
    label: "Channels",
    get: (p) => (p.channels.length > 0 ? p.channels.join(";") : "all"),
  },
  {
    key: "valid",
    label: "Valid",
    get: (p) => `${p.starts_at?.slice(0, 10) ?? "…"} to ${p.ends_at?.slice(0, 10) ?? "…"}`,
  },
  { key: "active", label: "Active", get: (p) => p.is_active },
];

export default function PromosPage() {
  const { data: promos, isPending } = useQuery(promosQueryOptions());
  const { sortKey, sortDir, toggle, sorted } = useSorting<PromoCode>("code");
  const rows = sorted(promos ?? [], {
    code: (p) => p.code,
    value: (p) => p.value,
    scope: (p) => p.scope,
    status: (p) => p.is_active,
  });

  if (isPending)
    return (
      <PageContainer pageTitle="Promo Codes" pageDescription="Marketing — Promos" isLoading>
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Promo Codes"
      pageDescription="Discount codes for bills, items and categories — channel-wise."
      pageHeaderAction={
        <Link
          href="/dashboard/marketing/promos/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> New promo
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="ml-auto">
          <ExportButton filename="promo-codes" rows={rows} columns={columns} />
        </span>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortTh
                    label="Code"
                    column="code"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Value"
                    column="value"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>
                  <SortTh
                    label="Scope"
                    column="scope"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>
                  <SortTh
                    label="Status"
                    column="status"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggle}
                  />
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-mono font-semibold">{p.code}</span>
                    <span className="block text-xs text-muted-foreground">{p.name}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.kind === "percent"
                      ? `${p.value}%`
                      : `${formatINR(p.value)}${p.scope === "order" ? "" : " /unit"}`}
                  </TableCell>
                  <TableCell className="text-xs capitalize">
                    {p.scope}
                    {p.scope !== "order" && (
                      <span className="text-muted-foreground"> · {p.target_ids.length}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">
                    {p.channels.length > 0
                      ? p.channels.map((c) => c.replace("_", " ")).join(", ")
                      : "All"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.starts_at?.slice(0, 10) ?? "…"} → {p.ends_at?.slice(0, 10) ?? "…"}
                  </TableCell>
                  <TableCell>
                    <StatusDot isActive={p.is_active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/marketing/promos/${p.id}/edit`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      <Icons.edit className="mr-1 size-3.5" /> Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No promo codes yet — create one for slow sellers from Item Sales.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
