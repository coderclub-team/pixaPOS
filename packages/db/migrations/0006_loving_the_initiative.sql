CREATE TABLE "crm_enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text,
	"outlets_planned" integer DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"assigned_to" text,
	"lead_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_followups" (
	"id" text PRIMARY KEY NOT NULL,
	"enquiry_id" text NOT NULL,
	"note" text NOT NULL,
	"next_follow_up_at" timestamp with time zone,
	"author_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ticket_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"note" text NOT NULL,
	"author_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"channel" text DEFAULT 'app' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"reporter_email" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "msg_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"template_id" text,
	"provider_id" text,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "msg_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"provider" text NOT NULL,
	"display_name" text NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_test_ok" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "msg_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"variables" text DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_followups" ADD CONSTRAINT "crm_followups_enquiry_id_crm_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."crm_enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ticket_notes" ADD CONSTRAINT "crm_ticket_notes_ticket_id_crm_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."crm_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_enquiries_status_idx" ON "crm_enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_enquiries_email_idx" ON "crm_enquiries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "crm_followups_enquiry_idx" ON "crm_followups" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "crm_ticket_notes_ticket_idx" ON "crm_ticket_notes" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "crm_tickets_status_idx" ON "crm_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_tickets_org_idx" ON "crm_tickets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "msg_outbox_status_idx" ON "msg_outbox" USING btree ("status");