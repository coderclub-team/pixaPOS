/**
 * RBAC data layer on Postgres (Phase 1 strangler: replaces Clerk-backed reads).
 * Roles are config-defined (lib/auth.ts access control); the admin UI persists
 * grants/revokes as overrides layered on the config base.
 */
import { and, eq } from "drizzle-orm";
import { ulid } from "@pixa/contracts";
import { db, baMember, baUser, rolePermissionOverrides } from "@pixa/db";
import { POS_PERMISSION_META, ROLE_PERMISSIONS } from "@/config/permissions";
import type { OrgMember, OrgPermission, OrgRole, RolesPermissionsData } from "./types";

const ROLE_KEYS = ["admin", "manager", "cashier", "waiter", "kitchen", "accountant"];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  waiter: "Waiter",
  kitchen: "Kitchen",
  accountant: "Accountant",
};

function displayRole(role: string): string {
  return role.startsWith("org:") ? role : `org:${role}`;
}

export async function effectivePermissions(role: string, outletId?: string): Promise<string[]> {
  const key = displayRole(role);
  const base = new Set(ROLE_PERMISSIONS[key] ?? ROLE_PERMISSIONS[role] ?? []);
  if (outletId) {
    const overrides = await db()
      .select()
      .from(rolePermissionOverrides)
      .where(
        and(eq(rolePermissionOverrides.outletId, outletId), eq(rolePermissionOverrides.role, key)),
      );
    for (const o of overrides) {
      if (o.granted) base.add(o.permission);
      else base.delete(o.permission);
    }
  }
  return [...base];
}

export async function getOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const rows = await db()
    .select({
      membershipId: baMember.id,
      userId: baMember.userId,
      role: baMember.role,
      name: baUser.name,
      email: baUser.email,
      image: baUser.image,
    })
    .from(baMember)
    .innerJoin(baUser, eq(baMember.userId, baUser.id))
    .where(eq(baMember.organizationId, organizationId));
  const members: OrgMember[] = [];
  for (const r of rows) {
    const [firstName, ...rest] = (r.name ?? "").split(" ");
    members.push({
      userId: r.userId,
      membershipId: r.membershipId,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      email: r.email,
      imageUrl: r.image ?? "",
      role: displayRole(r.role),
      roleName: ROLE_LABELS[r.role] ?? r.role,
      permissions: await effectivePermissions(r.role),
    });
  }
  return members.sort((a, b) => a.role.localeCompare(b.role));
}

export async function getOrgRoles(outletId?: string): Promise<OrgRole[]> {
  const roles: OrgRole[] = [];
  for (const key of ROLE_KEYS) {
    const perms = await effectivePermissions(key, outletId);
    roles.push({
      id: key,
      key: `org:${key}`,
      name: ROLE_LABELS[key] ?? key,
      description: null,
      permissionIds: perms,
    });
  }
  return roles;
}

export async function getOrgPermissions(): Promise<OrgPermission[]> {
  return POS_PERMISSION_META.map((p) => ({
    id: p.key,
    key: p.key,
    name: p.label,
    description: `${p.group} — ${p.label}`,
  }));
}

export async function getRolesPermissionsData(
  organizationId: string,
): Promise<RolesPermissionsData> {
  const [members, roles, permissions] = await Promise.all([
    getOrgMembers(organizationId),
    getOrgRoles(),
    getOrgPermissions(),
  ]);
  return { members, roles, permissions };
}

export async function updateMemberRole(organizationId: string, userId: string, role: string) {
  const key = role.replace(/^org:/, "");
  if (!ROLE_KEYS.includes(key)) throw new Error(`Unknown role: ${role}`);
  await db()
    .update(baMember)
    .set({ role: key })
    .where(and(eq(baMember.organizationId, organizationId), eq(baMember.userId, userId)));
}

export async function createPermission(name: string, key: string, description?: string) {
  // Permissions are config-defined; the sync action verifies coverage.
  const known = POS_PERMISSION_META.some((p) => p.key === key);
  if (!known) throw new Error(`Unknown permission key: ${key} — add it to config/permissions.ts`);
  return { id: key, key, name, description: description ?? "" };
}

/** Outlet scope for overrides resolves from the caller's active org. */
export async function assignPermissionToRole(roleId: string, permissionId: string) {
  await setOverride(roleId, permissionId, true);
}

export async function removePermissionFromRole(roleId: string, permissionId: string) {
  await setOverride(roleId, permissionId, false);
}

async function setOverride(roleId: string, permissionId: string, granted: boolean) {
  const role = displayRole(roleId.replace(/^org:/, ""));
  const database = db();
  await database
    .delete(rolePermissionOverrides)
    .where(
      and(
        eq(rolePermissionOverrides.outletId, "out_001"),
        eq(rolePermissionOverrides.role, role),
        eq(rolePermissionOverrides.permission, permissionId),
      ),
    );
  await database.insert(rolePermissionOverrides).values({
    id: ulid(),
    outletId: "out_001",
    role,
    permission: permissionId,
    granted,
    createdAt: new Date(),
  });
}
