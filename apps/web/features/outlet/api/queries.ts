import { queryOptions } from "@tanstack/react-query";
import { getOutlet, getOutletById } from "./service";

export const outletKeys = {
  all: ["outlet"] as const,
  detail: () => [...outletKeys.all, "detail"] as const,
  list: () => [...outletKeys.all, "list"] as const,
  profile: (id: string) => [...outletKeys.all, "profile", id] as const,
};

export const outletQueryOptions = queryOptions({
  queryKey: outletKeys.detail(),
  queryFn: getOutlet,
});

/**
 * Profile for an explicit outlet id: server table row for provisioned
 * outlets, legacy mock for out_001. The profile page follows the terminal's
 * active outlet through this — the table is the single truth.
 */
export const outletProfileQueryOptions = (id: string) =>
  queryOptions({
    queryKey: outletKeys.profile(id),
    queryFn: () => getOutletById(id),
  });

// Server-list multi-outlet helpers (no mock-service import — test-safe).
export {
  outletListKeys,
  outletsQueryOptions,
  getActiveOutletId,
  setActiveOutletId,
  resolveActiveOutlet,
  type OutletRow,
} from "./outlets";
