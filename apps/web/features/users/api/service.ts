import type { User, UserFilters, UsersResponse, UserMutationPayload } from "./types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const data = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getUsers(_orgId: string, filters: UserFilters = {}): Promise<UsersResponse> {
  return api<UsersResponse>(
    `/api/users${toQuery({
      search: filters.search,
      roles: filters.roles,
    })}`,
  );
}

export async function getUser(_orgId: string, id: string | number): Promise<User | null> {
  try {
    return await api<User>(`/api/users/${encodeURIComponent(String(id))}`);
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function createUser(
  _orgId: string,
  data: UserMutationPayload,
): Promise<{ success: boolean; user: User }> {
  return api<{ success: boolean; user: User }>("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  _orgId: string,
  id: string | number,
  data: UserMutationPayload,
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/users/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteUser(
  _orgId: string,
  id: string | number,
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/users/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}
