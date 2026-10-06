import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { msgOutbox, msgProviders, msgTemplates } from "@pixa/db";
import { maskConfig } from "@/lib/messaging-providers";
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messaging</h1>
        <p className="text-sm text-muted-foreground">
          Promotion blasts and transactional sends across email, WhatsApp and SMS — templated, every
          send ledgered, nothing silent.
        </p>
      </div>
      {dbDown ? (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          Database not connected.
        </p>
      ) : (
        <MessagingConsole
          initialTemplates={templates}
          initialProviders={providers}
          initialOutbox={outbox}
        />
      )}
    </div>
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
