import Link from "next/link";
import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { crmEnquiries } from "@pixa/db";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import { Icons } from "@pixa/ui/icons";
import PageContainer from "@/components/layout/page-container";
import { EnquiriesTable } from "./table";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  let enquiries: Awaited<ReturnType<typeof fetchEnquiries>> = [];
  let dbDown = false;
  try {
    enquiries = await fetchEnquiries();
  } catch {
    dbDown = true;
  }
  return (
    <PageContainer
      pageTitle="CRM"
      pageDescription="Customer enquiries, follow-ups and relationships. Enquiries are pre-organisation interest — approving one can link it to a registration lead."
      pageHeaderAction={
        <Button nativeButton={false} render={<Link href="/admin/crm/new" />}>
          <Icons.add className="size-4" aria-hidden />
          Add enquiry
        </Button>
      }
    >
      {dbDown ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>Set DATABASE_URL to review enquiries.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <EnquiriesTable initial={enquiries} />
      )}
    </PageContainer>
  );
}

async function fetchEnquiries() {
  return adminDb().select().from(crmEnquiries).orderBy(desc(crmEnquiries.createdAt)).limit(500);
}
