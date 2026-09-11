import { clerkClient } from "@clerk/nextjs/server";
import type { OrgMember, OrgPermission, OrgRole, RolesPermissionsData } from "./types";

export async function getOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const client = await clerkClient();
  const { data } = await client.organizations.getOrganizationMembershipList({
    organizationId,
    limit: 100,
  });
  return data
    .map((m) => {
      const user = m.publicUserData;
      const raw = m.raw as { role_name?: string } | null;
      return {
        userId: user?.userId ?? "",
        membershipId: m.id,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        email: user?.identifier ?? "",
        imageUrl: user?.imageUrl ?? "",
        role: m.role,
        roleName: raw?.role_name ?? m.role,
        permissions: m.permissions ?? [],
      };
    })
    .sort((a, b) => a.role.localeCompare(b.role));
}

export async function getOrgRoles(): Promise<OrgRole[]> {
  const client = await clerkClient();
  const { data } = await client.organizationRoles.getOrganizationRoleList({ limit: 100 });
  return data.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description ?? null,
    permissionIds: (r.permissions ?? []).map((p) => p.id),
  }));
}

export async function getOrgPermissions(): Promise<OrgPermission[]> {
  const client = await clerkClient();
  const { data } = await client.organizationPermissions.getOrganizationPermissionList({
    limit: 100,
  });
  return data.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description ?? "",
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
  const client = await clerkClient();
  await client.organizations.updateOrganizationMembership({ organizationId, userId, role });
}

export async function createPermission(name: string, key: string, description?: string) {
  const client = await clerkClient();
  const p = await client.organizationPermissions.createOrganizationPermission({
    name,
    key,
    description,
  });
  return { id: p.id, key: p.key, name: p.name, description: p.description ?? "" };
}

export async function assignPermissionToRole(roleId: string, permissionId: string) {
  const client = await clerkClient();
  await client.organizationRoles.assignPermissionToOrganizationRole({
    organizationRoleId: roleId,
    permissionId,
  });
}

export async function removePermissionFromRole(roleId: string, permissionId: string) {
  const client = await clerkClient();
  await client.organizationRoles.removePermissionFromOrganizationRole({
    organizationRoleId: roleId,
    permissionId,
  });
}
