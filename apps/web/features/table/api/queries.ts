import { queryOptions } from "@tanstack/react-query";
import { getTableById, getTables } from "./service";
import type { TableFilters } from "./types";

export const tableKeys = {
  all: ["tables"] as const,
  list: (filters?: TableFilters) => [...tableKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...tableKeys.all, "detail", id] as const,
};

export const tablesQueryOptions = (filters?: TableFilters) =>
  queryOptions({
    queryKey: tableKeys.list(filters),
    queryFn: () => getTables(filters),
  });

export const tableQueryOptions = (id: string) =>
  queryOptions({
    queryKey: tableKeys.detail(id),
    queryFn: () => getTableById(id),
  });
