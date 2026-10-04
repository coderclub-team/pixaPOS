CREATE TABLE "org_profiles" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"lifecycle" text DEFAULT 'trial' NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"mrr_paise" integer DEFAULT 0 NOT NULL,
	"owner_email" text,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_email" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text,
	"outlets_planned" integer DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"organization_id" text,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "saas_leads_status_idx" ON "saas_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saas_leads_email_idx" ON "saas_leads" USING btree ("email");