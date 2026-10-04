import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, baOrganization, baMember, orgProfiles } from "@pixa/db";
import { baSession } from "@/lib/auth-session";

const uid = (p: string) =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "business";
}

type OnboardingBody = {
  business_name?: string;
  currency?: string;
  country?: string;
  timezone?: string;
  outlet_name?: string;
  outlet_address?: string;
  outlets_count?: string;
  source?: string;
  monthly_orders?: string;
  lat?: string;
  lng?: string;
  plan?: string;
};

/**
 * POST /api/onboarding — self-serve trial provisioning (the funnel fork).
 * Creates the organization (caller becomes Owner/Admin), links the singleton
 * user, stores the outlet profile in org metadata JSON, opens the 14-day
 * trial row in orgProfiles (server trial truth), and seeds default POS
 * settings. Mirrors the admin lead-approve path for self-serve signups.
 */
export async function POST(req: Request) {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "sign-in required" }, { status: 401 });
  }
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "sign-in required" }, { status: 401 });

  let body: OnboardingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const businessName = (body.business_name ?? "").trim();
  const outletName = (body.outlet_name ?? "").trim();
  if (!businessName) return NextResponse.json({ error: "business name required" }, { status: 400 });
  if (!outletName) return NextResponse.json({ error: "initial outlet required" }, { status: 400 });

  const plan = ["starter", "growth", "scale", "trial"].includes((body.plan ?? "").trim())
    ? (body.plan as string).trim()
    : "starter";

  const metadata = {
    currency: (body.currency ?? "INR").trim() || "INR",
    country: (body.country ?? "IN").trim() || "IN",
    timezone: (body.timezone ?? "Asia/Kolkata").trim() || "Asia/Kolkata",
    outlet_name: (body.outlet_name ?? "").trim() || outletName,
    outlet_address: (body.outlet_address ?? "").trim(),
    outlets_count: (body.outlets_count ?? "1").trim() || "1",
    source: (body.source ?? "").trim(),
    monthly_orders: (body.monthly_orders ?? "").trim(),
    lat: (body.lat ?? "").trim(),
    lng: (body.lng ?? "").trim(),
    plan,
    pos_defaults: {
      tax_percent: 5,
      register_name: "Counter 1",
      currency: (body.currency ?? "INR").trim() || "INR",
    },
  };

  const database = db();
  const base = slugify(businessName);
  let slug = base;
  let orgId = "";
  let created = false;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    orgId = uid("org");
    try {
      await database.insert(baOrganization).values({
        id: orgId,
        name: businessName,
        slug,
        logo: null,
        createdAt: new Date(),
        metadata: JSON.stringify(metadata),
      });
      created = true;
    } catch {
      if (attempt === 4) {
        return NextResponse.json({ error: "could not create organization" }, { status: 500 });
      }
    }
  }

  await database.insert(baMember).values({
    id: uid("mem"),
    organizationId: orgId,
    userId: user.id,
    role: "admin",
    createdAt: new Date(),
  });

  const existing = await database
    .select({ organizationId: orgProfiles.organizationId })
    .from(orgProfiles)
    .where(eq(orgProfiles.organizationId, orgId))
    .limit(1);
  if (existing.length === 0) {
    await database.insert(orgProfiles).values({
      organizationId: orgId,
      lifecycle: "trial",
      plan,
      trialEndsAt: new Date(Date.now() + 14 * 86400 * 1000),
      ownerEmail: user.email ?? null,
    });
  }

  const res = NextResponse.json({ ok: true, organizationId: orgId, slug });
  res.headers.append("Set-Cookie", "pixa_funnel=; Path=/; Max-Age=0; SameSite=Lax");
  return res;
}
