/**
 * SaaS-owner tables (admin.pixapos.store).
 * Website registrations land here as leads; approving a lead creates a
 * Better Auth `organization` row, linked via `organizationId`.
 * Org lifecycle (Zoho/Odoo-style pipeline) lives in `orgProfiles`
 * so Better Auth defaults stay untouched.
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
