CREATE TABLE "reservation_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"table_id" text NOT NULL,
	"holder_name" text NOT NULL,
	"holder_phone" text,
	"party_size" integer NOT NULL,
	"hold_from" timestamp with time zone,
	"hold_until" timestamp with time zone,
	"status" text NOT NULL,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "table_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"table_id" text NOT NULL,
	"reason" text NOT NULL,
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_by" text,
	"until_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"released_by" text
);
--> statement-breakpoint
CREATE INDEX "reservation_holds_table_idx" ON "reservation_holds" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "table_blocks_table_idx" ON "table_blocks" USING btree ("table_id");