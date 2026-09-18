import PageContainer from "@/components/layout/page-container";
import { RolesPermissionsPage } from "@/features/rbac/components/roles-permissions-page";
import { getRolesPermissionsData } from "@/features/rbac/api/service";
import { orgContext } from "@/lib/auth-server";
import { hasDevBypass } from "@/lib/authz";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : Roles & Permissions" };

export default async function Page() {
  const ctx = await orgContext();
  const adminish = ctx.role === "org:admin" || ctx.role === "admin";
  if (!hasDevBypass() && (!ctx.orgId || !adminish)) {
    redirect("/dashboard/overview");
  }
  if (!ctx.orgId) redirect("/dashboard/overview");

  const data = await getRolesPermissionsData(ctx.orgId);

  return (
    <PageContainer
      pageTitle="Roles & Permissions"
      pageDescription="Manage organization members, roles and permissions. Restricted to super admins."
    >
      <RolesPermissionsPage data={data} />
    </PageContainer>
  );
}
