import PageContainer from "@/components/layout/page-container";
import { RolesPermissionsPage } from "@/features/rbac/components/roles-permissions-page";
import { getRolesPermissionsData } from "@/features/rbac/api/service";
import { hasDevBypass } from "@/lib/authz";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard : Roles & Permissions" };

export default async function Page() {
  const { orgId, orgRole } = await auth();
  if (!hasDevBypass() && orgRole !== "org:admin") {
    redirect("/dashboard/overview");
  }
  if (!orgId) redirect("/dashboard/overview");

  const data = await getRolesPermissionsData(orgId);

  return (
    <PageContainer
      pageTitle="Roles & Permissions"
      pageDescription="Manage organization members, roles and permissions. Restricted to super admins."
    >
      <RolesPermissionsPage data={data} />
    </PageContainer>
  );
}
