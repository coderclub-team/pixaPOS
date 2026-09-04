import { queryOptions } from "@tanstack/react-query";
import { getFloorById, getFloors } from "./service";
import type { FloorFilters } from "./types";

export const floorKeys = {
  all: ["floors"] as const,
  list: (filters?: FloorFilters) => [...floorKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...floorKeys.all, "detail", id] as const,
};

export const floorsQueryOptions = (filters?: FloorFilters) =>
  queryOptions({
    queryKey: floorKeys.list(filters),
    queryFn: () => getFloors(filters),
  });

export const floorQueryOptions = (id: string) =>
  queryOptions({
    queryKey: floorKeys.detail(id),
    queryFn: () => getFloorById(id),
  });
