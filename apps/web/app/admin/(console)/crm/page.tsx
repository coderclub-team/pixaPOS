import { desc } from "drizzle-orm";
import { adminDb } from "@/lib/saas-admin";
import { crmEnquiries } from "@pixa/db";
import { EnquiryBoard } from "./board";

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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Customer enquiries, follow-ups and relationships. Enquiries are pre-organisation interest
          — approving one can link it to a registration lead.
        </p>
      </div>
      {dbDown ? (
        <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          Database not connected.
        </p>
      ) : (
        <EnquiryBoard initial={enquiries} />
      )}
    </div>
  );
}

async function fetchEnquiries() {
  return adminDb().select().from(crmEnquiries).orderBy(desc(crmEnquiries.createdAt)).limit(200);
}
