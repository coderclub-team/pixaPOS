CREATE TABLE "org_usage" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"database_storage_bytes" integer DEFAULT 0 NOT NULL,
	"object_storage_bytes" integer DEFAULT 0 NOT NULL,
	"compute_cu_hours" integer DEFAULT 0 NOT NULL,
	"function_invocations" integer DEFAULT 0 NOT NULL,
	"data_transfer_bytes" integer DEFAULT 0 NOT NULL,
	"written_data_bytes" integer DEFAULT 0 NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"products_count" integer DEFAULT 0 NOT NULL,
	"customers_count" integer DEFAULT 0 NOT NULL,
	"users_count" integer DEFAULT 0 NOT NULL,
	"outlets_count" integer DEFAULT 0 NOT NULL,
	"devices_count" integer DEFAULT 0 NOT NULL,
	"infra_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_profiles" ADD COLUMN "plan_overrides" text;--> statement-breakpoint
ALTER TABLE "saas_plans" ADD COLUMN "limits" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_plans" ADD COLUMN "flags" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "org_usage_period_idx" ON "org_usage" USING btree ("period_start");