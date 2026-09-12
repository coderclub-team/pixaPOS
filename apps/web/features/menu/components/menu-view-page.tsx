"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { menuItemQueryOptions } from "../api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import { formatINR, toPaise } from "@/lib/money";

export default function MenuViewPage({ itemId }: { itemId: string }) {
  const { data } = useSuspenseQuery(menuItemQueryOptions(itemId));

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-left text-2xl font-bold">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block size-3 rounded-full",
                  data.veg_type === "veg" ? "bg-green-600" : "bg-red-600",
                )}
              />
              {data.name}
            </span>
            <StatusDot isActive={data.is_active} />
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-muted-foreground">Category</span>
            <span>{data.category_name ?? data.category_id}</span>
          </div>
          {data.description && (
            <div className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-muted-foreground">Description</span>
              <span className="text-right">{data.description}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-muted-foreground">Type</span>
            <span className="capitalize">
              {data.veg_type} · {data.item_type}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-muted-foreground">Tax</span>
            <span>
              {data.taxable ? `${data.tax_type ?? "GST"} ${data.tax_percent ?? 0}%` : "Non-taxable"}
              {data.hsn_code ? ` · ${data.hsn_code}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-muted-foreground">Channels</span>
            <span className="text-right capitalize">{data.available_channels.join(", ").replaceAll("_", " ")}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-left text-lg font-bold">
            Variants ({data.variants.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {data.variants.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border px-2 py-1.5 text-sm"
            >
              <span>
                <span className="font-medium">{v.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{v.sku}</span>
                {v.qty ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {v.qty}
                    {v.unit ?? ""}
                  </span>
                ) : null}
              </span>
              <span className="font-semibold">{formatINR(toPaise(v.selling_price))}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link
          href={`/dashboard/menu/items/${data.id}/edit`}
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.edit className="mr-2 h-4 w-4" /> Update item
        </Link>
      </div>
    </div>
  );
}
