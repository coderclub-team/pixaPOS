CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"user_id" text,
	"prefs" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "notif_prefs_outlet_idx" ON "notification_preferences" USING btree ("outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_prefs_scope_uidx" ON "notification_preferences" USING btree ("outlet_id","device_id","user_id");
