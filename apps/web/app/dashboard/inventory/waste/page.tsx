"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { WasteList } from "@/features/inventory/components/waste-list";
import { wasteQueryOptions } from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { can } from "@/lib/authz";
import { useOrganization } from "@clerk/nextjs";
import Link from "next/link";

const REASONS = [
  "spoilage",
  "expired",
  "overproduction",
  "trimming",
  "spillage",
  "order_cancelled",
  "other",
] as const;

export default function WastePage() {
  const { membership } = useOrganization();
  const canManageWaste = can(membership?.permissions, "org:waste:manage");
  const [search, setSearch] = React.useState("");
  const [reason, setReason] = React.useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: logs, isPending } = useQuery(
    wasteQueryOptions({ search: search || undefined, reason: reason as any }),
  );
  const totalLoss = (logs ?? []).reduce((s, w) => s + (w.cost_loss || 0), 0);
  const byMaterial = new Map<string, number>();
  (logs ?? []).forEach((w) => {
    const k = w.material_name ?? w.material_id ?? "—";
    byMaterial.set(k, (byMaterial.get(k) ?? 0) + (w.cost_loss || 0));
  });
  const top = [...byMaterial.entries()].sort((a, b) => b[1] - a[1])[0];
  if (isPending)
    return (
      <PageContainer pageTitle="Waste Log" pageDescription="Inventory — Food Wastage" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Waste Log"
      pageDescription="Inventory — Track spoilage, expired, overproduction, trimming, spillage. Cost loss auto-calculated and stock deducted."
      pageHeaderAction={
        canManageWaste ? (
          <Link
            href="/dashboard/inventory/waste/new"
            className={cn(buttonVariants(), "text-xs md:text-sm")}
          >
            <Icons.add className="mr-2 h-4 w-4" /> Log Waste
          </Link>
        ) : null
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Total cost loss</p>
            <p className="font-mono text-lg font-medium">₹{Math.round(totalLoss * 100) / 100}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Waste lines</p>
            <p className="font-mono text-lg font-medium">{(logs ?? []).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Top wasted material</p>
            <p className="text-sm font-medium">
              {top ? `${top[0]} — ₹${Math.round(top[1] * 100) / 100}` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search material, order..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={reason ?? "all"}
          onValueChange={(v) => setReason(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All reasons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            {REASONS.map((r) => (
              <SelectItem key={r} value={r} className="capitalize">
                {r.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <WasteList logs={logs ?? []} />
    </PageContainer>
  );
}
