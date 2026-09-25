"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@pixa/ui/base-ui/input";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@pixa/ui/base-ui/sidebar";
import { Icons } from "@pixa/ui/icons";
import { menuCategoriesQueryOptions } from "@/features/menu/api/queries";
import { useCategorySelection } from "./category-selection";

/**
 * App sidebar for the /kot page: dashboard sidebar primitives carrying the
 * menu categories. Selecting a category filters every menu browser on the
 * page through the shared selection context.
 */
export default function CategorySidebar() {
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
      <SidebarHeader>
        <div className="relative">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-sidebar pl-8 text-xs"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
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
    </>
  );
}
