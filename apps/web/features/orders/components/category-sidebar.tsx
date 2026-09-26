"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@pixa/ui/base-ui/sidebar";
import { Icons } from "@pixa/ui/icons";
import { UserAvatarProfile } from "@pixa/ui/user-avatar-profile";
import { menuCategoriesQueryOptions, menuItemsQueryOptions } from "@/features/menu/api/queries";
import { useIdentity } from "@/hooks/use-identity";
import { useCategorySelection } from "./category-selection";
import type { MenuCategory } from "@/features/menu/api/types";

/** Active-item counts per category (shared React Query cache — one fetch
 * no matter how many callers). Powers the counts in search rows. */
export function useCategoryCounts(): Record<string, number> {
  const { data: items } = useQuery(menuItemsQueryOptions({ is_active: true }));
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items ?? []) {
      counts[item.category_id] = (counts[item.category_id] ?? 0) + 1;
    }
    return counts;
  }, [items]);
}

/**
 * Category search dialog: type to filter, Enter picks the top match, tap a
 * row to jump the menu to that category. Reused by the /kot sidebar header
 * and the item-browser toolbar.
 */
export function CategorySearchDialog({
  open,
  onOpenChange,
  categories,
  counts,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: MenuCategory[];
  counts: Record<string, number>;
  value: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(needle));
  }, [categories, q]);
  const pick = (id: string | null) => {
    onSelect(id);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search categories</DialogTitle>
          <DialogDescription>Type to filter — Enter jumps to the top match.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search categories…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pick(matches[0]?.id ?? null);
              }
            }}
            className="pl-8"
            aria-label="Search categories"
          />
        </div>
        <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted touch-manipulation"
          >
            <Icons.layoutList className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 font-medium">All categories</span>
            {value == null && <Icons.check className="size-4 shrink-0 text-primary" />}
          </button>
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              aria-label={`Show ${c.name}, ${counts[c.id] ?? 0} items`}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted touch-manipulation"
            >
              <Icons.tag className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{c.name}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                {counts[c.id] ?? 0}
              </span>
              {value === c.id && <Icons.check className="size-4 shrink-0 text-primary" />}
            </button>
          ))}
          {matches.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No categories match — try another search.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * App sidebar for the /kot page: mirrors the dashboard app-sidebar
 * (brand header, menu groups, profile footer) with the menu categories
 * as its group. Selecting a category filters every menu browser on the
 * page through the shared selection context.
 */
export default function CategorySidebar() {
  const router = useRouter();
  const { user, signOut } = useIdentity();
  const selection = useCategorySelection();
  const { data: categories } = useQuery(menuCategoriesQueryOptions({}));
  const counts = useCategoryCounts();
  const [searchOpen, setSearchOpen] = useState(false);

  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active),
    [categories],
  );
  const visible = activeCategories;

  // Scroll-to-fetch: render in pages of 20, append near the bottom so the
  // first paint stays light even with 50+ categories.
  const [catLimit, setCatLimit] = useState(20);
  useEffect(() => {
    setCatLimit(20);
  }, [activeCategories.length]);
  const shown = visible.slice(0, catLimit);
  const onCatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 300) return;
    setCatLimit((n) => (visible.length > n ? Math.min(visible.length, n + 20) : n));
  };

  const categoryId = selection?.categoryId ?? null;
  const select = (id: string | null) => selection?.setCategoryId(id);

  // Before any table is tapped there is no menu to browse — show the same
  // empty placeholder language as the bill panel.
  if (!selection?.activeOrderId) {
    return (
      <>
        <SidebarHeader className="group-data-[collapsible=icon]:pt-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/dashboard/overview" aria-label="pixaPOS home" />}
                tooltip="pixaPOS"
              >
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon.png" alt="pixaPOS" className="size-full object-cover" />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-bold">pixaPOS · KOT</span>
                  <span className="truncate text-xs text-muted-foreground">Counter terminal</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="overflow-x-hidden">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="rounded-full border border-dashed p-3">
              <Icons.orders className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No table selected</p>
            <p className="text-sm text-muted-foreground">
              Tap a table on the floor to open its bill — categories appear here.
            </p>
          </div>
        </SidebarContent>
      </>
    );
  }

  return (
    <>
      <SidebarHeader className="group-data-[collapsible=icon]:pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard/overview" aria-label="pixaPOS home" />}
              tooltip="pixaPOS"
            >
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="pixaPOS" className="size-full object-cover" />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-bold">pixaPOS · KOT</span>
                <span className="truncate text-xs text-muted-foreground">Counter terminal</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="group-data-[collapsible=icon]:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSearchOpen(true)}
            title="Search categories"
            aria-label="Search categories"
            className="h-9 w-full justify-start bg-sidebar px-2.5 text-xs font-normal text-muted-foreground"
          >
            <Icons.search className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">
              {activeCategories.find((c) => c.id === categoryId)?.name ?? "Search categories…"}
            </span>
          </Button>
        </div>
      </SidebarHeader>
      <CategorySearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        categories={activeCategories}
        counts={counts}
        value={categoryId}
        onSelect={select}
      />
      <SidebarContent className="overflow-x-hidden" onScroll={onCatScroll}>
        <SidebarGroup className="py-0">
          <SidebarGroupLabel>
            Categories{visible.length > shown.length ? ` (${shown.length}/${visible.length})` : ""}
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={categoryId == null}
                onClick={() => select(null)}
                tooltip="All categories"
              >
                <Icons.layoutList />
                <span>All</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {shown.map((c) => (
              <SidebarMenuItem key={c.id}>
                <SidebarMenuButton
                  isActive={categoryId === c.id}
                  onClick={() => select(categoryId === c.id ? null : c.id)}
                  tooltip={c.name}
                >
                  <Icons.tag />
                  <span>{c.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {visible.length === 0 && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-2 py-8 text-center">
            <div className="rounded-full border border-dashed p-2.5">
              <Icons.search className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No categories match</p>
            <p className="text-xs text-muted-foreground">Try another search.</p>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                {user && <UserAvatarProfile className="h-8 w-8 rounded-lg" showInfo user={user} />}
                <Icons.chevronsDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--anchor-width) min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="px-1 py-1.5">
                      {user && (
                        <UserAvatarProfile className="h-8 w-8 rounded-lg" showInfo user={user} />
                      )}
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/order-terminal")}>
                    <Icons.dashboard className="mr-2 size-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/notifications")}>
                    <Icons.notification className="mr-2 size-4" />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <Icons.logout aria-hidden className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </>
  );
}
