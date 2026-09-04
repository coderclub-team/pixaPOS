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

const seededUsers: User[] = [
  {
    id: 1,
    first_name: "Arul",
    last_name: "Owner",
    email: "owner@pixapos.com",
    phone: "9876543210",
    status: "Active",
    role: "org:admin",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    first_name: "Priya",
    last_name: "Manager",
    email: "manager@pixapos.com",
    phone: "9876543211",
    status: "Active",
    role: "org:manager",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    first_name: "Rahul",
    last_name: "Cashier",
    email: "cashier@pixapos.com",
    phone: "9876543212",
    status: "Active",
    role: "org:cashier",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 4,
    first_name: "Sonia",
    last_name: "Waiter",
    email: "waiter@pixapos.com",
    phone: "9876543213",
    status: "Active",
    role: "org:waiter",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 5,
    first_name: "Amit",
    last_name: "Kitchen",
    email: "kitchen@pixapos.com",
    phone: "9876543214",
    status: "Active",
    role: "org:kitchen",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 6,
    first_name: "Neha",
    last_name: "Accountant",
    email: "accountant@pixapos.com",
    phone: "9876543215",
    status: "Active",
    role: "org:accountant",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 7,
    first_name: "Vikram",
    last_name: "Waiter2",
    email: "waiter2@pixapos.com",
    phone: "9876543216",
    status: "Invited",
    role: "org:waiter",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 8,
    first_name: "Anjali",
    last_name: "Cashier2",
    email: "cashier2@pixapos.com",
    phone: "9876543217",
    status: "Inactive",
    role: "org:cashier",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let records: User[] = [...seededUsers];

export const fakeUsers = {
  records,

  initialize() {
    records = [...seededUsers];
    this.records = records;
  },

  async getAll({ roles = [], search }: { roles?: string[]; search?: string }) {
    let users = [...this.records];
    if (roles.length > 0) users = users.filter((u) => roles.includes(u.role));
    if (search) {
      const q = search.toLowerCase();
      users = users.filter((u) =>
        `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q),
      );
    }
    return users;
  },

  async createUser(data: Omit<User, "id" | "created_at" | "updated_at">) {
    await delay(800);
    const newUser: User = {
      ...data,
      id: this.records.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.records.push(newUser);
    return { success: true, message: "User created successfully", user: newUser };
  },

  async updateUser(id: number, data: Omit<User, "id" | "created_at" | "updated_at">) {
    await delay(800);
    const idx = this.records.findIndex((u) => u.id === id);
    if (idx === -1) return { success: false, message: `User with ID ${id} not found` };
    this.records[idx] = { ...this.records[idx], ...data, updated_at: new Date().toISOString() };
    return { success: true, message: "User updated successfully", user: this.records[idx] };
  },

  async deleteUser(id: number) {
    await delay(800);
    const idx = this.records.findIndex((u) => u.id === id);
    if (idx === -1) return { success: false, message: `User with ID ${id} not found` };
    this.records.splice(idx, 1);
    return { success: true, message: "User deleted successfully" };
  },

  async getUsers({
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
  }) {
    await delay(800);
    const rolesArray = roles ? (Array.isArray(roles) ? roles : String(roles).split(/[.,]/)) : [];
    const allUsers = await this.getAll({ roles: rolesArray, search });

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
      message: "Sample POS users",
      total_users: totalUsers,
      offset,
      limit,
      users: paginatedUsers,
    };
  },
};

fakeUsers.initialize();
