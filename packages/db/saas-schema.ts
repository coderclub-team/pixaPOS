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
  /** JSON map of organization-specific limit overrides (ResourceLimit → number). */
  planOverrides: text("plan_overrides"),
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
  /** JSON map of resource limits (ResourceLimit → number|null). */
  limits: text("limits").notNull().default("{}"),
  /** JSON map of boolean feature flags (Feature → boolean). */
  flags: text("flags").notNull().default("{}"),
  outletLimit: integer("outlet_limit"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Per-organization usage snapshot. Product counts are recomputed live from
 * operational tables; infrastructure metrics (storage/compute/functions/
 * transfer/written data) are synchronized periodically from Neon consumption
 * data. Monthly resources reset with the billing period; persistent resources
 * do not. One row per organization (current period).
 */
export const orgUsage = pgTable(
  "org_usage",
  {
    organizationId: text("organization_id").primaryKey(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

    databaseStorageBytes: integer("database_storage_bytes").default(0).notNull(),
    objectStorageBytes: integer("object_storage_bytes").default(0).notNull(),

    computeCuHours: integer("compute_cu_hours").default(0).notNull(),
    functionInvocations: integer("function_invocations").default(0).notNull(),
    dataTransferBytes: integer("data_transfer_bytes").default(0).notNull(),
    writtenDataBytes: integer("written_data_bytes").default(0).notNull(),

    ordersCount: integer("orders_count").default(0).notNull(),
    productsCount: integer("products_count").default(0).notNull(),
    customersCount: integer("customers_count").default(0).notNull(),
    usersCount: integer("users_count").default(0).notNull(),
    outletsCount: integer("outlets_count").default(0).notNull(),
    devicesCount: integer("devices_count").default(0).notNull(),

    infraSyncedAt: timestamp("infra_synced_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("org_usage_period_idx").on(t.periodStart)],
);

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

/* ------------------------------------------------------------------ */
/* CRM + messaging (SaaS-owner console).                                */
/* Enquiries are pre-organisation interest (any channel); approving or  */
/* linking one may create a saasLeads row, but CRM never writes to     */
/* restaurant tables. Provider configs hold third-party credentials    */
/* for WhatsApp/SMS/email/Meta/Google — readable only via owner-gated  */
/* APIs, secrets masked in every response.                             */
/* ------------------------------------------------------------------ */

export const ENQUIRY_STATUS = ["new", "contacted", "qualified", "converted", "lost"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUS)[number];

export const TICKET_STATUS = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUS)[number];

export const TICKET_PRIORITY = ["low", "normal", "high", "urgent"] as const;

export const MSG_CHANNELS = ["email", "whatsapp", "sms"] as const;
export type MsgChannel = (typeof MSG_CHANNELS)[number];

export const MSG_STATUS = ["queued", "sending", "sent", "failed"] as const;

export const crmEnquiries = pgTable(
  "crm_enquiries",
  {
    id: text("id").primaryKey(),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    city: text("city"),
    outletsPlanned: integer("outlets_planned").default(1).notNull(),
    source: text("source").default("website").notNull(),
    status: text("status").default("new").notNull(),
    assignedTo: text("assigned_to"),
    leadId: text("lead_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("crm_enquiries_status_idx").on(t.status),
    index("crm_enquiries_email_idx").on(t.email),
  ],
);

export const crmFollowups = pgTable(
  "crm_followups",
  {
    id: text("id").primaryKey(),
    enquiryId: text("enquiry_id")
      .notNull()
      .references(() => crmEnquiries.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    authorEmail: text("author_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("crm_followups_enquiry_idx").on(t.enquiryId)],
);

export const crmTickets = pgTable(
  "crm_tickets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    channel: text("channel").default("app").notNull(),
    priority: text("priority").default("normal").notNull(),
    status: text("status").default("open").notNull(),
    assignedTo: text("assigned_to"),
    reporterEmail: text("reporter_email"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("crm_tickets_status_idx").on(t.status),
    index("crm_tickets_org_idx").on(t.organizationId),
  ],
);

export const crmTicketNotes = pgTable(
  "crm_ticket_notes",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => crmTickets.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    authorEmail: text("author_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("crm_ticket_notes_ticket_idx").on(t.ticketId)],
);

export const msgTemplates = pgTable("msg_templates", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  variables: text("variables").notNull().default("[]"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const msgProviders = pgTable("msg_providers", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  provider: text("provider").notNull(),
  displayName: text("display_name").notNull(),
  config: text("config").notNull().default("{}"),
  isActive: boolean("is_active").default(true).notNull(),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const msgOutbox = pgTable(
  "msg_outbox",
  {
    id: text("id").primaryKey(),
    channel: text("channel").notNull(),
    to: text("to").notNull(),
    templateId: text("template_id"),
    providerId: text("provider_id"),
    subject: text("subject"),
    body: text("body").notNull(),
    status: text("status").default("queued").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("msg_outbox_status_idx").on(t.status)],
);
