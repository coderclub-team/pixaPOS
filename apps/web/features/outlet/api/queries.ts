import { queryOptions } from "@tanstack/react-query";
import { getOutlet } from "./service";

export const outletKeys = {
  all: ["outlet"] as const,
  detail: () => [...outletKeys.all, "detail"] as const,
};

export const outletQueryOptions = queryOptions({
  queryKey: outletKeys.detail(),
  queryFn: getOutlet,
});
