import { queryOptions } from "@tanstack/react-query";
import { getUser, getUsers } from "./service";
import type { User, UserFilters } from "./types";

export type { User };

export const userKeys = {
  all: ["users"] as const,
  list: (orgId: string, filters: UserFilters) => [...userKeys.all, "list", orgId, filters] as const,
  detail: (orgId: string, id: number) => [...userKeys.all, "detail", orgId, id] as const,
};

export const usersQueryOptions = (orgId: string, filters: UserFilters) =>
  queryOptions({
    queryKey: userKeys.list(orgId, filters),
    queryFn: () => getUsers(orgId, filters),
  });

export const userQueryOptions = (orgId: string, id: number) =>
  queryOptions({
    queryKey: userKeys.detail(orgId, id),
    queryFn: () => getUser(orgId, id),
  });
