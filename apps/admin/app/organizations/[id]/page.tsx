import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/db";
import { baInvitation, baMember, baOrganization, orgProfiles, saasAudit } from "@pixa/db";
import { LifecycleBadge } from "./page";
import { OrgActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function OrgDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let org,
    profile,
    members: unknown[] = [],
    invites: unknown[] = [];
  try {
    const db = adminDb();
    const rows = await db.select().from(baOrganization).where(eq(baOrganization.id, id));
    org = rows[0];
    if (!org) notFound();
    profile =
      (await db.select().from(orgProfiles).where(eq(orgProfiles.organizationId, id)))[0] ?? null;
    members = await db.select().from(baMember).where(eq(baMember.organizationId, id));
    invites = await db.select().from(baInvitation).where(eq(baInvitation.organizationId, id));
  } catch {
    return (
      <div className="rounded-xl border bg-white p-8 text-sm">
        <h1 className="text-xl font-semibold">Database not connected</h1>
        <p className="mt-1 text-zinc-600">
          Set <code>DATABASE_URL</code> to inspect this organisation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <a href="/organizations" className="text-sm text-zinc-600 hover:underline">
        ← All organisations
      </a>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-white p-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{org!.name}</h1>
          <p className="text-sm text-zinc-600">
            {org!.slug} · created {new Date(org!.createdAt).toLocaleString("en-IN")}
          </p>
          <div className="mt-2 flex gap-2">
            <LifecycleBadge value={profile?.lifecycle ?? "trial"} />
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize">
              {profile?.plan ?? "starter"} plan
            </span>
          </div>
        </div>
        <OrgActions id={org!.id} profile={profile} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">Members</p>
          <p className="mt-1 text-2xl font-semibold">{members.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">Pending invites</p>
          <p className="mt-1 text-2xl font-semibold">{invites.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">MRR</p>
          <p className="mt-1 text-2xl font-semibold">
            ₹{((profile?.mrrPaise ?? 0) / 100).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Owner & subscription notes</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Owner: {profile?.ownerEmail ?? "—"} · Trial ends:{" "}
          {profile?.trialEndsAt ? new Date(profile.trialEndsAt).toLocaleDateString("en-IN") : "—"}
        </p>
        {profile?.notes && <p className="mt-2 text-sm">{profile.notes}</p>}
      </div>
    </div>
  );
}

export { saasAudit };
