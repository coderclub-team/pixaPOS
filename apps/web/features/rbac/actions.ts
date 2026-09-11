"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { POS_PERMISSION_META } from "@/config/permissions";
import { hasDevBypass } from "@/lib/authz";
import {
  assignPermissionToRole,
  createPermission,
  getOrgPermissions,
  removePermissionFromRole,
  updateMemberRole,
} from "./api/service";

type ActionResult = { ok: boolean; message: string };

async function assertSuperAdmin(): Promise<string> {
  const { orgId, orgRole } = await auth();
  if (!orgId) throw new Error("No active organization selected.");
  if (!hasDevBypass() && orgRole !== "org:admin") {
    throw new Error("Only super admins can manage roles and permissions.");
  }
  return orgId;
}

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export async function updateMemberRoleAction(userId: string, role: string): Promise<ActionResult> {
  try {
    const orgId = await assertSuperAdmin();
    await updateMemberRole(orgId, userId, role);
    revalidatePath("/dashboard/roles");
    return { ok: true, message: "Role updated." };
  } catch (e) {
    return { ok: false, message: toError(e) };
  }
}

export async function setRolePermissionAction(
  roleId: string,
  permissionId: string,
  assigned: boolean,
): Promise<ActionResult> {
  try {
    await assertSuperAdmin();
    if (assigned) {
      await assignPermissionToRole(roleId, permissionId);
    } else {
      await removePermissionFromRole(roleId, permissionId);
    }
    revalidatePath("/dashboard/roles");
    return { ok: true, message: assigned ? "Permission granted." : "Permission revoked." };
  } catch (e) {
    return { ok: false, message: toError(e) };
  }
}

export async function syncPosPermissionsAction(): Promise<ActionResult & { created: number }> {
  try {
    await assertSuperAdmin();
    const existing = await getOrgPermissions();
    const existingKeys = new Set(existing.map((p) => p.key));
    const missing = POS_PERMISSION_META.filter((p) => !existingKeys.has(p.key));
    for (const perm of missing) {
      await createPermission(perm.label, perm.key, `${perm.group} — ${perm.label}`);
    }
    revalidatePath("/dashboard/roles");
    return {
      ok: true,
      created: missing.length,
      message:
        missing.length === 0
          ? "All POS permissions already exist."
          : `Created ${missing.length} permission${missing.length === 1 ? "" : "s"}.`,
    };
  } catch (e) {
    return { ok: false, created: 0, message: toError(e) };
  }
}
