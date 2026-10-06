import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { msgOutbox, msgProviders, msgTemplates } from "@pixa/db";
import { maskConfig } from "@/lib/messaging-providers";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pixa/ui/base-ui/empty";
import PageContainer from "@/components/layout/page-container";
import { MessagingConsole } from "./console";

export const dynamic = "force-dynamic";

export default async function MessagingPage() {
  let templates: Awaited<ReturnType<typeof fetchTemplates>> = [];
  let providers: Awaited<ReturnType<typeof fetchProviders>> = [];
  let outbox: Awaited<ReturnType<typeof fetchOutbox>> = [];
  let dbDown = false;
  try {
    [templates, providers, outbox] = await Promise.all([
      fetchTemplates(),
      fetchProviders(),
      fetchOutbox(),
    ]);
  } catch {
    dbDown = true;
  }
  return (
    <PageContainer
      pageTitle="Messaging"
      pageDescription="Promotion blasts and transactional sends across email, WhatsApp and SMS — templated, every send ledgered, nothing silent."
    >
      {dbDown ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Database not connected</EmptyTitle>
                <EmptyDescription>Set DATABASE_URL to manage messaging.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <MessagingConsole
          initialTemplates={templates}
          initialProviders={providers}
          initialOutbox={outbox}
        />
      )}
    </PageContainer>
  );
}

async function fetchTemplates() {
  const rows = await adminDb().select().from(msgTemplates).orderBy(msgTemplates.name).limit(200);
  return rows.map((t) => ({ ...t, variables: JSON.parse(t.variables ?? "[]") as string[] }));
}

async function fetchProviders() {
  const rows = await adminDb().select().from(msgProviders).orderBy(msgProviders.channel).limit(100);
  return rows.map((p) => ({
    ...p,
    config: maskConfig(JSON.parse(p.config ?? "{}") as Record<string, string>),
  }));
}

async function fetchOutbox() {
  return adminDb()
    .select({
      id: msgOutbox.id,
      channel: msgOutbox.channel,
      to: msgOutbox.to,
      status: msgOutbox.status,
      error: msgOutbox.error,
      createdBy: msgOutbox.createdBy,
      createdAt: msgOutbox.createdAt,
      sentAt: msgOutbox.sentAt,
    })
    .from(msgOutbox)
    .orderBy(desc(msgOutbox.createdAt))
    .limit(100);
}
