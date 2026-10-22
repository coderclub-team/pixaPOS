import { fakeUsers } from "@/constants/mock-api-users";
import type { UserFilters, UsersResponse, UserMutationPayload } from "./types";

export async function getUsers(orgId: string, filters: UserFilters): Promise<UsersResponse> {
  return fakeUsers.getUsers(orgId, filters);
}

export async function getUser(orgId: string, id: number) {
  const all = await fakeUsers.getAll(orgId, {});
  return all.find((u) => u.id === id) ?? null;
}

export async function createUser(orgId: string, data: UserMutationPayload) {
  return fakeUsers.createUser(orgId, data);
}

export async function updateUser(orgId: string, id: number, data: UserMutationPayload) {
  return fakeUsers.updateUser(orgId, id, data);
}

export async function deleteUser(orgId: string, id: number) {
  return fakeUsers.deleteUser(orgId, id);
}
