CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"po_number" text NOT NULL,
	"supplier_id" text NOT NULL REFERENCES "suppliers"("id"),
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"po_date" text,
	"expected_at" text,
	"notes" text
);--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purchase_order_id" text NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
	"material_id" text NOT NULL REFERENCES "raw_materials"("id"),
	"qty" integer NOT NULL,
	"unit" text,
	"unit_cost_paise" bigint DEFAULT 0 NOT NULL,
	"tax_percent" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"purchase_number" text NOT NULL,
	"purchase_order_id" text REFERENCES "purchase_orders"("id"),
	"supplier_id" text NOT NULL REFERENCES "suppliers"("id"),
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"landed_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"paid_paise" bigint DEFAULT 0 NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"payment_mode" text,
	"bill_date" text,
	"notes" text
);--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purchase_id" text NOT NULL REFERENCES "purchases"("id") ON DELETE CASCADE,
	"material_id" text NOT NULL REFERENCES "raw_materials"("id"),
	"qty" integer NOT NULL,
	"unit" text,
	"unit_cost_paise" bigint DEFAULT 0 NOT NULL,
	"batch_no" text
);--> statement-breakpoint
CREATE INDEX "purchase_orders_org_outlet_idx" ON "purchase_orders" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchases_org_outlet_idx" ON "purchases" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "purchases_supplier_idx" ON "purchases" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");
