import Link from "next/link";
import { adminDb } from "@/lib/saas-admin";
import { saasOwnerRoles } from "@pixa/db";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { InviteOwnerForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewOwnerPage() {
  let roles: { id: string; name: string }[] = [];
  try {
    roles = await adminDb()
      .select({ id: saasOwnerRoles.id, name: saasOwnerRoles.name })
      .from(saasOwnerRoles);
  } catch {
    /* invite form still works without roles */
  }
  return (
    <PageContainer
      pageTitle="Invite owner user"
      pageDescription="Create a scoped staff account. Separate identity plane from restaurant users."
    >
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/admin/users" />}
          className="px-0"
        >
          <Icons.chevronLeft className="size-3.5" aria-hidden />
          All owner users
        </Button>
      </div>
      <InviteOwnerForm roles={roles} />
    </PageContainer>
  );
}
