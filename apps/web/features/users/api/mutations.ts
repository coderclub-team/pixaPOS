import { mutationOptions } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { createUser, updateUser, deleteUser } from "./service";
import { userKeys } from "./queries";
import type { UserMutationPayload } from "./types";

export const createUserMutation = mutationOptions({
  mutationFn: ({ orgId, values }: { orgId: string; values: UserMutationPayload }) =>
    createUser(orgId, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  },
});

export const updateUserMutation = mutationOptions({
  mutationFn: ({
    orgId,
    id,
    values,
  }: {
    orgId: string;
    id: string | number;
    values: UserMutationPayload;
  }) => updateUser(orgId, id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  },
});

export const deleteUserMutation = mutationOptions({
  mutationFn: ({ orgId, id }: { orgId: string; id: string | number }) => deleteUser(orgId, id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  },
});
