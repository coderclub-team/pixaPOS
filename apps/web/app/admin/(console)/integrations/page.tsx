import { asc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { msgProviders } from "@pixa/db";
import { maskConfig } from "@/lib/messaging-providers";
import { IntegrationsConsole } from "./console";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  let providers: Awaited<ReturnType<typeof fetchProviders>> = [];
  let dbDown = false;
  try {
    providers = await fetchProviders();
  } catch {
    dbDown = true;
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp, SMS, email, Meta and Google Ads providers. Secrets are masked everywhere —
          re-enter a value to rotate it, blank keeps the stored one. Test before activating.
        </p>
      </div>
      {dbDown ? (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          Database not connected.
        </p>
      ) : (
        <IntegrationsConsole initialProviders={providers} />
      )}
    </div>
  );
}

async function fetchProviders() {
  const rows = await adminDb().select().from(msgProviders).orderBy(asc(msgProviders.channel));
  return rows.map((p) => ({
    ...p,
    config: maskConfig(JSON.parse(p.config ?? "{}") as Record<string, string>),
  }));
}
