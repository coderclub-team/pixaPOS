import { queryOptions } from "@tanstack/react-query";
import { rewardBalance, rewardLedger, rewardsOutstanding } from "./service";

export const rewardKeys = {
  all: ["rewards"] as const,
  balance: (customerId: string) => [...rewardKeys.all, "balance", customerId] as const,
  ledger: (customerId: string) => [...rewardKeys.all, "ledger", customerId] as const,
};

export const rewardBalanceQueryOptions = (customerId: string) =>
  queryOptions({
    queryKey: rewardKeys.balance(customerId),
    queryFn: () => rewardBalance(customerId),
  });

export const rewardLedgerQueryOptions = (customerId: string) =>
  queryOptions({
    queryKey: rewardKeys.ledger(customerId),
    queryFn: () => rewardLedger(customerId),
  });

export const rewardsOutstandingQueryOptions = () =>
  queryOptions({ queryKey: rewardKeys.all, queryFn: rewardsOutstanding });
