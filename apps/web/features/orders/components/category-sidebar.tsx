"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@pixa/ui/base-ui/input";
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
import { menuCategoriesQueryOptions } from "@/features/menu/api/queries";
import { useIdentity } from "@/hooks/use-identity";
import { useCategorySelection } from "./category-selection";

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
  const [search, setSearch] = useState("");
  const { data: categories } = useQuery(menuCategoriesQueryOptions({}));

  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.is_active),
    [categories],
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeCategories;
    return activeCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [activeCategories, search]);

  const categoryId = selection?.categoryId ?? null;
  const select = (id: string | null) => selection?.setCategoryId(id);

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
        <div className="relative group-data-[collapsible=icon]:hidden">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-sidebar pl-8 text-xs"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="py-0">
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
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
            {visible.map((c) => (
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
