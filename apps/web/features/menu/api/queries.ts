import { queryOptions } from "@tanstack/react-query";
import { getMenuCategories, getMenuCategoryById, getMenuItemById, getMenuItems } from "./service";
import type { MenuCategoryFilters, MenuItemFilters } from "./types";

export const menuKeys = {
  all: ["menu"] as const,
  categories: (filters?: MenuCategoryFilters) =>
    [...menuKeys.all, "categories", filters ?? {}] as const,
  category: (id: string) => [...menuKeys.all, "category", id] as const,
  items: (filters?: MenuItemFilters) => [...menuKeys.all, "items", filters ?? {}] as const,
  item: (id: string) => [...menuKeys.all, "item", id] as const,
};

export const menuCategoriesQueryOptions = (filters?: MenuCategoryFilters) =>
  queryOptions({
    queryKey: menuKeys.categories(filters),
    queryFn: () => getMenuCategories(filters),
  });
export const menuCategoryQueryOptions = (id: string) =>
  queryOptions({ queryKey: menuKeys.category(id), queryFn: () => getMenuCategoryById(id) });
export const menuItemsQueryOptions = (filters?: MenuItemFilters) =>
  queryOptions({ queryKey: menuKeys.items(filters), queryFn: () => getMenuItems(filters) });
export const menuItemQueryOptions = (id: string) =>
  queryOptions({ queryKey: menuKeys.item(id), queryFn: () => getMenuItemById(id) });
