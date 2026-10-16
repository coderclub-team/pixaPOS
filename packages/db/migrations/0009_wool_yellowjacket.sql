ALTER TABLE "devices" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "push_token" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "realtime_connection_id" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "sequence" bigint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_device_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "station_ids" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "target" jsonb;--> statement-breakpoint
CREATE TABLE "outlet_kitchen_stations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "stations_outlet_idx" ON "outlet_kitchen_stations" USING btree ("outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_outlet_code_uidx" ON "outlet_kitchen_stations" USING btree ("outlet_id","code");--> statement-breakpoint
CREATE INDEX "events_outlet_seq_idx" ON "events" USING btree ("outlet_id","sequence");--> statement-breakpoint
CREATE INDEX "events_org_outlet_seq_idx" ON "events" USING btree ("organization_id","outlet_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "events_outlet_seq_uidx" ON "events" USING btree ("outlet_id","sequence");
