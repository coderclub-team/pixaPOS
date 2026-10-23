CREATE TABLE "supplier_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"type" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"payment_mode" text NOT NULL,
	"payment_date" text NOT NULL,
	"reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"raw_material_id" text,
	"material_name" text,
	"recipe_id" text,
	"recipe_name" text,
	"variant_id" text,
	"variant_name" text,
	"order_id" text,
	"order_number" text,
	"qty" numeric DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"photo_url" text,
	"cost_loss_paise" bigint DEFAULT 0 NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "stock_qty" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "low_stock_threshold" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "cost_price_paise" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "avg_cost_paise" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "manufacturer" text;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "purchase_unit" text;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "purchase_to_base_rate" numeric;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "tax_type" text DEFAULT 'GST';--> statement-breakpoint
ALTER TABLE "raw_materials" ADD COLUMN "suppliers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "yield_unit" text DEFAULT 'serves';--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "steps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "selling_price_paise" bigint;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "prep_time_min" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cook_time_min" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "plating_notes" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "garnish" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "serving_vessel" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "contact_person" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "supplier_adjustments" ADD CONSTRAINT "supplier_adjustments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_adj_org_outlet_idx" ON "supplier_adjustments" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "supplier_adj_supplier_idx" ON "supplier_adjustments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_pay_org_outlet_idx" ON "supplier_payments" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "supplier_pay_supplier_idx" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "waste_logs_org_outlet_idx" ON "waste_logs" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "waste_logs_material_idx" ON "waste_logs" USING btree ("raw_material_id");