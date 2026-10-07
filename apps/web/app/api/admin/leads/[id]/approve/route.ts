import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb, uid } from "@/lib/saas-admin";
import { auditOwnerAction, requireOwnerApi } from "@/lib/saas-owner";
import { baMember, baOrganization, baUser, orgProfiles, saasLeads } from "@pixa/db";

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "org"
  );
}

/** Approve a website lead → Better Auth org + owner member + trial profile (idempotent). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerApi(["leads:write"]);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    const db = adminDb();
    const lead = (await db.select().from(saasLeads).where(eq(saasLeads.id, id)))[0];
    if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
    if (lead.organizationId)
      return NextResponse.json({ ok: true, organizationId: lead.organizationId, reused: true });

    // Ensure owner user exists (Better Auth user table)
    let owner = (await db.select().from(baUser).where(eq(baUser.email, lead.email)))[0];
    if (!owner) {
      owner = {
        id: uid("user"),
        name: lead.contactName,
        email: lead.email,
        emailVerified: false,
        image: null,
        phoneNumber: null,
        phoneNumberVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(baUser).values(owner);
    }

    const base = slugify(lead.businessName);
    let slug = base,
      orgId = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      orgId = uid("org");
      try {
        await db.insert(baOrganization).values({
          id: orgId,
          name: lead.businessName,
          slug,
          logo: null,
          createdAt: new Date(),
          metadata: JSON.stringify({
            city: lead.city,
            outletsPlanned: lead.outletsPlanned,
            leadId: lead.id,
          }),
        });
        break;
      } catch (e) {
        if (attempt === 4) throw e; // slug collision → retry with suffix
      }
    }
    await db.insert(baMember).values({
      id: uid("mem"),
      organizationId: orgId,
      userId: owner.id,
      role: "admin",
      createdAt: new Date(),
    });
    await db.insert(orgProfiles).values({
      organizationId: orgId,
      lifecycle: "trial",
      plan: "starter",
      trialEndsAt: new Date(Date.now() + 14 * 86400 * 1000),
      ownerEmail: lead.email,
    });
    await db
      .update(saasLeads)
      .set({
        status: "converted",
        organizationId: orgId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(saasLeads.id, id));
    await auditOwnerAction(
      auth.owner,
      "organization",
      orgId,
      "ORG_CREATED_FROM_LEAD",
      `${lead.businessName} <${lead.email}>`,
    );
    return NextResponse.json({ ok: true, organizationId: orgId });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "approve failed" },
      { status: 500 },
    );
  }
}
