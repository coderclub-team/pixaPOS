import { POS_ROLES } from "@/config/roles";

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  role: string;
  created_at: string;
  updated_at: string;
};

/**
 * Session-local team store, keyed by organization. Starts empty — no seeded
 * users. (Server-backed team management is a follow-up; until then each
 * org sees only the users created in it during this browser session.)
 */
const stores = new Map<string, User[]>();

function storeFor(orgId: string): User[] {
  let users = stores.get(orgId);
  if (!users) {
    users = [];
    stores.set(orgId, users);
  }
  return users;
}

export const fakeUsers = {
  async getAll(orgId: string, { roles = [], search }: { roles?: string[]; search?: string }) {
    let users = [...storeFor(orgId)];
    if (roles.length > 0) users = users.filter((u) => roles.includes(u.role));
    if (search) {
      const q = search.toLowerCase();
      users = users.filter((u) =>
        `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q),
      );
    }
    return users;
  },

  async createUser(orgId: string, data: Omit<User, "id" | "created_at" | "updated_at">) {
    await delay(800);
    const records = storeFor(orgId);
    const newUser: User = {
      ...data,
      id: records.length > 0 ? Math.max(...records.map((u) => u.id)) + 1 : 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    records.push(newUser);
    return { success: true, message: "User created successfully", user: newUser };
  },

  async updateUser(
    orgId: string,
    id: number,
    data: Omit<User, "id" | "created_at" | "updated_at">,
  ) {
    await delay(800);
    const records = storeFor(orgId);
    const idx = records.findIndex((u) => u.id === id);
    if (idx === -1) return { success: false, message: `User with ID ${id} not found` };
    records[idx] = { ...records[idx], ...data, updated_at: new Date().toISOString() };
    return { success: true, message: `User updated successfully`, user: records[idx] };
  },

  async deleteUser(orgId: string, id: number) {
    await delay(800);
    const records = storeFor(orgId);
    const idx = records.findIndex((u) => u.id === id);
    if (idx === -1) return { success: false, message: `User with ID ${id} not found` };
    records.splice(idx, 1);
    return { success: true, message: "User deleted successfully" };
  },

  async getUsers(
    orgId: string,
    {
      page = 1,
      limit = 10,
      roles,
      search,
      sort,
    }: {
      page?: number;
      limit?: number;
      roles?: string | string[];
      search?: string;
      sort?: string;
    },
  ) {
    await delay(800);
    const rolesArray = roles ? (Array.isArray(roles) ? roles : String(roles).split(/[.,]/)) : [];
    const allUsers = await this.getAll(orgId, { roles: rolesArray, search });

    if (sort) {
      try {
        const sortItems = JSON.parse(sort) as { id: string; desc: boolean }[];
        if (sortItems.length > 0) {
          const { id, desc } = sortItems[0];
          allUsers.sort((a, b) => {
            const aVal =
              id === "name" ? `${a.first_name} ${a.last_name}` : (a as Record<string, unknown>)[id];
            const bVal =
              id === "name" ? `${b.first_name} ${b.last_name}` : (b as Record<string, unknown>)[id];
            const aStr = String(aVal ?? "").toLowerCase();
            const bStr = String(bVal ?? "").toLowerCase();
            return desc ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
          });
        }
      } catch {
        // ignore
      }
    }

    const totalUsers = allUsers.length;
    const offset = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    return {
      success: true,
      time: new Date().toISOString(),
      message: "Users fetched successfully",
      total_users: totalUsers,
      offset,
      limit,
      users: paginatedUsers,
    };
  },
};
