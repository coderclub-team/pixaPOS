CREATE TABLE "applied_commands" (
	"command_id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"server_version" integer,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"phone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"device_id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_type" text NOT NULL,
	"name" text NOT NULL,
	"last_sync_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"actor_id" text,
	"reason_text" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floors" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_txns" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"raw_material_id" text NOT NULL,
	"transaction_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" text,
	"reference_id" text
);
--> statement-breakpoint
CREATE TABLE "kot_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"kot_id" text NOT NULL,
	"order_line_id" text NOT NULL,
	"qty" integer NOT NULL,
	"voided_qty" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"item_name_snapshot" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kots" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"order_id" text NOT NULL,
	"kot_number" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupancy_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"table_id" text NOT NULL,
	"floor_id" text NOT NULL,
	"seats" integer NOT NULL,
	"label" text,
	"color_index" integer DEFAULT 0 NOT NULL,
	"order_id" text,
	"status" text NOT NULL,
	"seated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"release_reason" text,
	"force_released" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"variant_id" text,
	"modifier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"line_total_paise" bigint DEFAULT 0 NOT NULL,
	"line_tax_paise" bigint DEFAULT 0 NOT NULL,
	"kot_id" text,
	"item_name_snapshot" text NOT NULL,
	"instructions" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"order_number" text NOT NULL,
	"channel" text DEFAULT 'dine_in' NOT NULL,
	"table_id" text,
	"occupancy_group_id" text,
	"customer_id" text,
	"customer_name" text,
	"customer_phone" text,
	"status" text NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"grand_total_paise" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"order_id" text NOT NULL,
	"method" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"tendered_paise" bigint,
	"change_paise" bigint DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"partition_label" text
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"order_id" text NOT NULL,
	"payment_id" text,
	"amount_paise" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"floor_id" text NOT NULL,
	"number" text NOT NULL,
	"code" text NOT NULL,
	"capacity" integer NOT NULL,
	"shape" text DEFAULT 'square' NOT NULL,
	"type" text DEFAULT 'standard' NOT NULL,
	"allows_sharing" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"x_mm" integer DEFAULT 0 NOT NULL,
	"y_mm" integer DEFAULT 0 NOT NULL,
	"w_mm" integer DEFAULT 0 NOT NULL,
	"h_mm" integer DEFAULT 0 NOT NULL,
	"rotation_deg" integer DEFAULT 0 NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "applied_commands_id_uidx" ON "applied_commands" USING btree ("command_id");--> statement-breakpoint
CREATE INDEX "events_entity_idx" ON "events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "events_outlet_time_idx" ON "events" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_txns_material_idx" ON "inventory_txns" USING btree ("raw_material_id");--> statement-breakpoint
CREATE INDEX "kot_lines_kot_idx" ON "kot_lines" USING btree ("kot_id");--> statement-breakpoint
CREATE INDEX "kots_order_idx" ON "kots" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "occupancy_table_idx" ON "occupancy_groups" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_table_idx" ON "orders" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "orders_outlet_status_idx" ON "orders" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "tables_floor_idx" ON "tables" USING btree ("floor_id");