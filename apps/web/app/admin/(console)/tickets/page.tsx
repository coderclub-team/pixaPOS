import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { crmTickets } from "@pixa/db";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import PageContainer from "@/components/layout/page-container";
import { TicketBoard } from "./board";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  let tickets: Awaited<ReturnType<typeof fetchTickets>> = [];
  let dbDown = false;
  try {
    tickets = await fetchTickets();
  } catch {
    dbDown = true;
  }
  return (
    <PageContainer
      pageTitle="Complaint tickets"
      pageDescription="Addressing mechanism for restaurant complaints: triage, assign, resolve with a full note trail. Nothing auto-closes — a human marks resolved."
    >
      {dbDown ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>Set DATABASE_URL to review tickets.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <TicketBoard initial={tickets} />
      )}
    </PageContainer>
  );
}

async function fetchTickets() {
  return adminDb().select().from(crmTickets).orderBy(desc(crmTickets.createdAt)).limit(200);
}
