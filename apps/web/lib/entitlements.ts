/**
 * Central entitlement service — the ONLY place plan/limit/feature decisions
 * are resolved. Never scatter `if (plan === "growth")` through the app.
 *
 * Effective limit = organization override ?? plan limit, resolved centrally.
 * Server-side use only (reads the admin DB). Client surfaces read usage via
 * the /api/billing/usage (org) and /api/admin routes.
 */
import { eq } from "drizzle-orm";
import {
  DEFAULT_PLAN_ID,
  FEATURES,
  RESOURCE_LIMITS,
  orgProfiles,
  planById,
  saasPlans,
  type Feature,
  type LimitMap,
  type ResourceLimit,
} from "@pixa/db";
import { adminDb } from "@/lib/saas-admin";

export type { Feature, ResourceLimit };

export type PlanInfo = {
  id: string;
  name: string;
  tagline: string | null;
  monthlyPaise: number | null;
  limits: LimitMap;
  flags: Record<Feature, boolean>;
  /** True when the resolved plan row came from the seeded defaults. */
  isFallback: boolean;
};

const NULL_LIMITS: LimitMap = RESOURCE_LIMITS.reduce((acc, r) => {
  acc[r] = null;
  return acc;
}, {} as LimitMap);

const FALSE_FLAGS = FEATURES.reduce(
  (acc, f) => {
    acc[f] = false;
    return acc;
  },
  {} as Record<Feature, boolean>,
);

function mergeLimits(raw: unknown): LimitMap {
  const out: LimitMap = { ...NULL_LIMITS };
  if (raw && typeof raw === "object") {
    for (const r of RESOURCE_LIMITS) {
      const v = (raw as Record<string, unknown>)[r];
      if (typeof v === "number" && Number.isFinite(v)) out[r] = v;
      else if (v === null) out[r] = null;
    }
  }
  return out;
}

function mergeFlags(raw: unknown): Record<Feature, boolean> {
  const out: Record<Feature, boolean> = { ...FALSE_FLAGS };
  if (raw && typeof raw === "object") {
    for (const f of FEATURES) {
      const v = (raw as Record<string, unknown>)[f];
      if (typeof v === "boolean") out[f] = v;
    }
  }
  return out;
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Resolve the plan row (DB-first, seeded defaults fallback). */
export async function getPlan(organizationId: string): Promise<PlanInfo> {
  let planId = DEFAULT_PLAN_ID;
  try {
    const row = (
      await adminDb()
        .select({ plan: orgProfiles.plan })
        .from(orgProfiles)
        .where(eq(orgProfiles.organizationId, organizationId))
    )[0];
    if (row?.plan) planId = row.plan;
  } catch {
    /* fall back to default plan */
  }

  try {
    const dbRow = (await adminDb().select().from(saasPlans).where(eq(saasPlans.id, planId)))[0];
    if (dbRow) {
      const baseLimits = planById(planId)?.limits ?? NULL_LIMITS;
      const baseFlags = planById(planId)?.flags ?? FALSE_FLAGS;
      const dbLimits = mergeLimits(parseJson(dbRow.limits));
      // Overlay only explicitly-set DB limits over the seeded defaults, so a
      // row created before the limits column reads as the default plan.
      const limits: LimitMap = { ...baseLimits };
      for (const r of RESOURCE_LIMITS) if (dbLimits[r] !== null) limits[r] = dbLimits[r];

      const rawFlags = parseJson(dbRow.flags);
      const hasFlags =
        !!rawFlags && typeof rawFlags === "object" && Object.keys(rawFlags).length > 0;
      return {
        id: dbRow.id,
        name: dbRow.name,
        tagline: dbRow.tagline,
        monthlyPaise: dbRow.monthlyPaise,
        limits,
        flags: hasFlags ? mergeFlags(rawFlags) : baseFlags,
        isFallback: false,
      };
    }
  } catch {
    /* fall through to defaults */
  }

  const fallback = planById(planId) ?? planById(DEFAULT_PLAN_ID)!;
  return {
    id: fallback.id,
    name: fallback.name,
    tagline: fallback.tagline,
    monthlyPaise: fallback.monthlyPaise,
    limits: fallback.limits,
    flags: fallback.flags,
    isFallback: true,
  };
}

async function getOverrides(organizationId: string): Promise<Partial<LimitMap>> {
  try {
    const row = (
      await adminDb()
        .select({ planOverrides: orgProfiles.planOverrides })
        .from(orgProfiles)
        .where(eq(orgProfiles.organizationId, organizationId))
    )[0];
    const parsed = parseJson(row?.planOverrides ?? null);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<LimitMap> = {};
    for (const r of RESOURCE_LIMITS) {
      const v = (parsed as Record<string, unknown>)[r];
      if (typeof v === "number" && Number.isFinite(v)) out[r] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Effective limits = plan limits with organization overrides applied. */
export async function getLimits(organizationId: string): Promise<LimitMap> {
  const [plan, overrides] = await Promise.all([
    getPlan(organizationId),
    getOverrides(organizationId),
  ]);
  return { ...plan.limits, ...overrides };
}

export async function getFeatures(organizationId: string): Promise<Record<Feature, boolean>> {
  const plan = await getPlan(organizationId);
  return plan.flags;
}

export async function can(organizationId: string, feature: Feature): Promise<boolean> {
  return (await getFeatures(organizationId))[feature] === true;
}

export type LimitResult = {
  ok: boolean;
  resource: ResourceLimit;
  current: number;
  limit: number | null;
  requested: number;
};

/** Non-throwing quota check. `null` limit (custom) is treated as allowed. */
export function checkLimitValue(
  limits: LimitMap,
  usage: Record<ResourceLimit, number>,
  resource: ResourceLimit,
  requested = 1,
): LimitResult {
  const limit = limits[resource];
  const current = usage[resource] ?? 0;
  if (limit === null) return { ok: true, resource, current, limit, requested };
  return { ok: current + requested <= limit, resource, current, limit, requested };
}

export class EntitlementError extends Error {
  code: "PLAN_LIMIT_REACHED" | "FEATURE_NOT_IN_PLAN";
  status = 402;
  constructor(
    public payload: {
      code: "PLAN_LIMIT_REACHED" | "FEATURE_NOT_IN_PLAN";
      resource?: ResourceLimit;
      current?: number;
      limit?: number | null;
      requested?: number;
      feature?: Feature;
      plan: string;
      upgradeRequired: boolean;
      message: string;
    },
  ) {
    super(payload.message);
    this.code = payload.code;
  }
}

/** Structured limit error matching the platform contract. */
export function limitError(plan: string, result: LimitResult): EntitlementError {
  return new EntitlementError({
    code: "PLAN_LIMIT_REACHED",
    resource: result.resource,
    current: result.current,
    limit: result.limit,
    requested: result.requested,
    plan,
    upgradeRequired: true,
    message: `${plan} plan limit reached for ${result.resource}.`,
  });
}

/** Feature guard — throws when the plan does not include the feature. */
export async function requireFeature(organizationId: string, feature: Feature): Promise<void> {
  const plan = await getPlan(organizationId);
  if (plan.flags[feature] !== true) {
    throw new EntitlementError({
      code: "FEATURE_NOT_IN_PLAN",
      feature,
      plan: plan.id,
      upgradeRequired: true,
      message: `${plan.name} does not include ${feature}.`,
    });
  }
}

/**
 * Quota guard for a resource given the caller's already-resolved usage.
 * Throws EntitlementError(PLAN_LIMIT_REACHED) when the invariant
 * `current + requested <= limit` would break.
 */
export async function requireLimit(
  organizationId: string,
  resource: ResourceLimit,
  requested: number,
  usage: Record<ResourceLimit, number>,
): Promise<void> {
  const [plan, limits] = await Promise.all([getPlan(organizationId), getLimits(organizationId)]);
  const result = checkLimitValue(limits, usage, resource, requested);
  if (!result.ok) throw limitError(plan.id, result);
}
