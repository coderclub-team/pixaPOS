"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { StockLedger } from "@/features/inventory/components/stock-ledger";
import {
  stockLedgerQueryOptions,
  rawMaterialsQueryOptions,
} from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@pixa/ui/base-ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@pixa/ui/base-ui/command";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

export default function StockPage() {
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState<string | undefined>(undefined);
  const [materialId, setMaterialId] = React.useState<string | undefined>(undefined);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  const { data: materials } = useQuery(rawMaterialsQueryOptions());
  const { data: entries, isPending } = useQuery(
    stockLedgerQueryOptions({
      search: search || undefined,
      material_id: materialId,
      type: type as any,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
  );

  const kpis = React.useMemo(() => {
    const ms = materials ?? [];
    const totalValue = ms.reduce((s, m) => s + m.stock_qty * m.avg_cost, 0);
    const totalQty = ms.reduce((s, m) => s + m.stock_qty, 0);
    const lowStock = ms.filter((m) => m.stock_qty <= m.low_stock_threshold).length;
    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalQty,
      lowStock,
    };
  }, [materials]);

  const materialOptions = (materials ?? []).map((m) => ({
    label: `${m.name} (${m.sku})`,
    value: m.id,
  }));
  const selectedMaterialLabel = materialOptions.find((o) => o.value === materialId)?.label;

  if (isPending)
    return (
      <PageContainer
        pageTitle="Stock Ledger"
        pageDescription="Inventory — Stock transactions with valuation"
        isLoading
      >
        <div />
      </PageContainer>
    );

  return (
    <PageContainer
      pageTitle="Stock Ledger"
      pageDescription="Global stock history — Odoo Stock Moves / Zoho Stock Movement. Qty, valuation, running balance per entry. Filters: material, type, date, search."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Inventory Value</div>
            <div className="font-mono text-lg font-bold">₹{kpis.totalValue.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Qty × Avg (WAC)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Qty On Hand</div>
            <div className="font-mono text-lg font-bold">{kpis.totalQty}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Low Stock Items</div>
            <div
              className={cn("font-mono text-lg font-bold", kpis.lowStock > 0 && "text-destructive")}
            >
              {kpis.lowStock}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search material / reference..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-[160px] justify-between font-normal",
                  !materialId && "text-muted-foreground",
                )}
              />
            }
          >
            <span className="truncate text-left">{selectedMaterialLabel ?? "All materials"}</span>
            <Icons.chevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-[--anchor-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search SKU or name..." />
              <CommandList>
                <CommandEmpty>No results</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__all__"
                    onSelect={() => setMaterialId(undefined)}
                    keywords={["all"]}
                  >
                    <Icons.check
                      className={cn("mr-2 h-4 w-4", !materialId ? "opacity-100" : "opacity-0")}
                    />
                    All materials
                  </CommandItem>
                  {materialOptions.slice(0, 50).map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      keywords={[opt.label]}
                      onSelect={(v) => setMaterialId(v)}
                    >
                      <Icons.check
                        className={cn(
                          "mr-2 h-4 w-4",
                          materialId === opt.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Select value={type ?? "all"} onValueChange={(v) => setType(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="purchase_return">Return</SelectItem>
            <SelectItem value="waste">Waste</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
            <SelectItem value="recipe_consumption">Consumption</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[140px]"
          placeholder="From"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[140px]"
          placeholder="To"
        />
        {(materialId || type || dateFrom || dateTo || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMaterialId(undefined);
              setType(undefined);
              setDateFrom("");
              setDateTo("");
              setInputValue("");
              setSearch("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="mt-4">
        <StockLedger entries={entries ?? []} />
      </div>
    </PageContainer>
  );
}
