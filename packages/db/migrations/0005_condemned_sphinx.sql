CREATE TABLE "saas_owner_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"permissions" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saas_owner_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "saas_owner_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "saas_owners" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'super_owner' NOT NULL,
	"role_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "saas_owners_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "saas_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"monthly_paise" integer,
	"annual_discount_pct" integer DEFAULT 0 NOT NULL,
	"features" text DEFAULT '[]' NOT NULL,
	"outlet_limit" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_owner_sessions" ADD CONSTRAINT "saas_owner_sessions_owner_id_saas_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."saas_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saas_owner_sessions_owner_idx" ON "saas_owner_sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "saas_owners_email_idx" ON "saas_owners" USING btree ("email");