CREATE TABLE "outlets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "outlets_org_idx" ON "outlets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_org_code_uidx" ON "outlets" USING btree ("organization_id","code");--> statement-breakpoint
-- Backfill existing mock outlet out_001 for org fallback
INSERT INTO "outlets" ("id","organization_id","name","code") VALUES ('out_001','org_001','Main Outlet','PX001') ON CONFLICT DO NOTHING;
