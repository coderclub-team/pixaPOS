ALTER TABLE "refunds" ALTER COLUMN "amount_paise" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "kot_lines" ADD COLUMN "returned_qty" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "kot_lines" ADD COLUMN "variant_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "kot_lines" ADD COLUMN "modifiers_snapshot" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "kot_lines" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "order_number_snapshot" text;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "table_number_snapshot" text;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "station_ids" jsonb;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "fired_by" text;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "fired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "voids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "returns" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "kot_line_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tax_percent_snapshot" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "recipe_id_snapshot" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "modifiers_snapshot" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "returned_qty" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_number_snapshot" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address_snapshot" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rider_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "off_hours" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "off_hours_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_percent" numeric;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promo_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promo_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reward_points" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "split" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "received_by" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "order_line_id" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "qty" integer;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "return_id" text;