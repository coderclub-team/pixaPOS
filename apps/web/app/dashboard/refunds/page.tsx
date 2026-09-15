"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import { Input } from "@pixa/ui/base-ui/input";
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
import { cn } from "@pixa/ui/lib/utils";
import { formatINR } from "@/lib/money";
import { paymentKeys, refundsQueryOptions } from "@/features/payments/api/queries";
import type { Refund } from "@/features/payments/api/types";
import { getQueryClient } from "@/lib/query-client";
import { useCrossTabSync } from "@/lib/use-cross-tab-sync";

const STATUSES: { value: Refund["status"] | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "REFUND_PENDING", label: "Gateway pending" },
  { value: "REFUND_FAILED", label: "Failed" },
];

function StatusPill({ status }: { status: Refund["status"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "REFUNDED" &&
          "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
        status === "REFUND_PENDING" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        status === "REFUND_FAILED" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
      )}
    >
      {status === "REFUNDED"
        ? "Refunded"
        : status === "REFUND_PENDING"
          ? "Gateway pending"
          : "Failed"}
    </span>
  );
}

export default function RefundsPage() {
  useCrossTabSync();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<Refund["status"] | "all">("all");

  const { data: refunds, isPending } = useQuery({
    ...refundsQueryOptions({
      search: search || undefined,
      status: status === "all" ? undefined : status,
    }),
    refetchInterval: 10000,
  });

  if (isPending) {
    return (
      <PageContainer pageTitle="Refunds" pageDescription="Sales — Refunds" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Refunds"
      pageDescription="Money returned to customers — item-wise returns refund to the original payment methods."
      pageHeaderAction={
        <Button
          variant="outline"
          size="sm"
          title="Refresh refunds"
          onClick={() => {
            getQueryClient().invalidateQueries({ queryKey: paymentKeys.all });
          }}
        >
          <Icons.refresh className="size-4" />
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by refund, order, or reason…"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (typeof window !== "undefined") {
              window.clearTimeout((window as any).__refundSearchT);
              (window as any).__refundSearchT = window.setTimeout(
                () => setSearch(e.target.value),
                300,
              );
            }
          }}
          className="max-w-sm"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as Refund["status"] | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(refunds ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-full border border-dashed p-3">
              <Icons.refund className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No refunds yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Item-wise returns from a served bill appear here with their original payment method.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Refund</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(refunds ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      #{r.id.slice(-6).toUpperCase()}
                      {r.qty ? (
                        <span className="ml-1 text-muted-foreground">· {r.qty}×</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/orders/${r.order_id}`)}
                        className="font-medium underline-offset-4 hover:underline"
                        title="Open order"
                      >
                        {r.order_number ?? `#${r.order_id.slice(-6).toUpperCase()}`}
                      </button>
                    </TableCell>
                    <TableCell className="capitalize">
                      {r.method ? (
                        <span className="flex items-center gap-1">
                          <Icons.refund className="size-3.5 text-muted-foreground" />
                          {r.method.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground" title={r.reason}>
                      {r.reason}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      −{formatINR(r.amount_paise)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" className="h-8 w-8 p-0" />}
                        >
                          <Icons.ellipsis className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          </DropdownMenuGroup>
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/orders/${r.order_id}`)}
                            >
                              <Icons.orders className="mr-2 h-4 w-4" /> View order
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
