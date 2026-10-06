import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { crmTickets } from "@pixa/db";
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Complaint tickets</h1>
        <p className="text-sm text-muted-foreground">
          Addressing mechanism for restaurant complaints: triage, assign, resolve with a full note
          trail. Nothing auto-closes — a human marks resolved.
        </p>
      </div>
      {dbDown ? (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          Database not connected.
        </p>
      ) : (
        <TicketBoard initial={tickets} />
      )}
    </div>
  );
}

async function fetchTickets() {
  return adminDb().select().from(crmTickets).orderBy(desc(crmTickets.createdAt)).limit(200);
}
