import { queryOptions } from "@tanstack/react-query";
import { getOverviewData } from "./service";
import type { OverviewFilters } from "./types";

export const overviewKeys = {
  all: ["overview"] as const,
  data: (filters: OverviewFilters) => [...overviewKeys.all, "data", filters] as const,
};

export const overviewQueryOptions = (filters: OverviewFilters) =>
  queryOptions({
    queryKey: overviewKeys.data(filters),
    queryFn: () => getOverviewData(filters),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
