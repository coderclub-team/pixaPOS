/**
 * SaaS-owner tables (admin.pixapos.store).
 * Website registrations land here as leads; approving a lead creates a
 * Better Auth `organization` row, linked via `organizationId`.
 * Org lifecycle (trial → active pipeline) lives in `orgProfiles`
 * so Better Auth defaults stay untouched.
 *
 * Owner identity (saasOwners/saasOwnerRoles/saasOwnerSessions) is a
 * SEPARATE identity plane from restaurant users (baUser/baMember):
 * no foreign keys cross the planes in either direction, so a compromise
 * of restaurant credentials can never resolve to an owner session.
 */
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const LEAD_STATUS = ["new", "contacted", "trial", "converted", "rejected"] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const ORG_LIFECYCLE = ["trial", "active", "past_due", "suspended", "churned"] as const;
export type OrgLifecycle = (typeof ORG_LIFECYCLE)[number];

export const saasLeads = pgTable(
  "saas_leads",
  {
    id: text("id").primaryKey(),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    city: text("city"),
    outletsPlanned: integer("outlets_planned").default(1).notNull(),
    source: text("source").default("website").notNull(),
    notes: text("notes"),
    status: text("status").default("new").notNull(),
    organizationId: text("organization_id"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("saas_leads_status_idx").on(t.status), index("saas_leads_email_idx").on(t.email)],
);

export const orgProfiles = pgTable("org_profiles", {
  organizationId: text("organization_id").primaryKey(),
  lifecycle: text("lifecycle").default("trial").notNull(),
  plan: text("plan").default("starter").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  mrrPaise: integer("mrr_paise").default(0).notNull(),
  ownerEmail: text("owner_email"),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const saasAudit = pgTable("saas_audit", {
  id: text("id").primaryKey(),
  actorEmail: text("actor_email"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Scoped staff roles for the owner console (owner-created, e.g. support,
 * billing). Permissions are a JSON string array, see SAAS_PERMISSIONS. */
export const saasOwnerRoles = pgTable("saas_owner_roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  permissions: text("permissions").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Singleton SaaS owner + owner-created staff. Separate plane from baUser:
 * no FK to (or from) restaurant identity tables. role is "super_owner"
 * (full powers, exactly one enforced in code) or "staff" (see roleId). */
export const saasOwners = pgTable(
  "saas_owners",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").default("super_owner").notNull(),
    roleId: text("role_id"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [index("saas_owners_email_idx").on(t.email)],
);

/** Owner-managed subscription plan catalog (single source of truth for
 * plan name/price/features; orgProfiles.plan references a row by id).
 * Seeded to match the landing catalog; the billing page renders from here. */
export const saasPlans = pgTable("saas_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  monthlyPaise: integer("monthly_paise"),
  annualDiscountPct: integer("annual_discount_pct").default(0).notNull(),
  features: text("features").notNull().default("[]"),
  outletLimit: integer("outlet_limit"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Server-side owner sessions (opaque bearer, sha256 at rest, revocable).
 * Checked per request from the `pixa_owner` httpOnly cookie. */
export const saasOwnerSessions = pgTable(
  "saas_owner_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => saasOwners.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("saas_owner_sessions_owner_idx").on(t.ownerId)],
);
