"use client";
import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { MenuList } from "@/features/menu/components/menu-list";
import { menuCategoriesQueryOptions, menuItemsQueryOptions } from "@/features/menu/api/queries";
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
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";

export default function MenuItemsPage() {
  const [search, setSearch] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined);
  const [veg, setVeg] = React.useState<string | undefined>(undefined);
  const [channel, setChannel] = React.useState<string | undefined>(undefined);
  const [showActiveOnly, setShowActiveOnly] = React.useState(true);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(id);
  }, [inputValue]);
  const { data: categories } = useQuery(menuCategoriesQueryOptions());
  const { data: items, isPending } = useQuery(
    menuItemsQueryOptions({
      search: search || undefined,
      category_id: categoryId,
      veg_type: veg as any,
      channel: channel as any,
      is_active: showActiveOnly ? true : undefined,
    }),
  );
  if (isPending)
    return (
      <PageContainer pageTitle="Menu Items" pageDescription="Menu — Catalog" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Menu Items"
      pageDescription="Dishes — list like other inventory pages. Pricing per variant, GST optional, recipe link. Image upload placeholder not used this phase."
      pageHeaderAction={
        <Link
          href="/dashboard/menu/items/new"
          className={cn(buttonVariants(), "text-xs md:text-sm")}
        >
          <Icons.add className="mr-2 h-4 w-4" /> Add Dish
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search dish, SKU, variant..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={categoryId ?? "all"}
          onValueChange={(v) => setCategoryId(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={veg ?? "all"} onValueChange={(v) => setVeg(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All veg" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="veg">Veg</SelectItem>
            <SelectItem value="nonveg">Non-veg</SelectItem>
            <SelectItem value="egg">Egg</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={channel ?? "all"}
          onValueChange={(v) => setChannel(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="dine_in">Dine-in</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
            <SelectItem value="zomato">Zomato</SelectItem>
            <SelectItem value="swiggy">Swiggy</SelectItem>
            <SelectItem value="ondc">ONDC</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
          />{" "}
          Active only
        </label>
      </div>
      <MenuList items={items ?? []} />
    </PageContainer>
  );
}
