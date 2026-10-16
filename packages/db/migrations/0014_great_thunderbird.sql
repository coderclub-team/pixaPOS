CREATE TABLE "menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text,
	"parent_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" text REFERENCES "menu_categories"("id"),
	"product_type" text DEFAULT 'simple' NOT NULL,
	"item_type" text DEFAULT 'goods' NOT NULL,
	"veg_type" text,
	"hsn_code" text,
	"taxable" boolean DEFAULT true NOT NULL,
	"tax_percent" integer DEFAULT 0 NOT NULL,
	"modifier_group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);--> statement-breakpoint
CREATE TABLE "menu_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"menu_item_id" text NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
	"sku" text,
	"selling_price" bigint DEFAULT 0 NOT NULL,
	"compare_price" bigint,
	"recipe_id" text,
	"is_default" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"selection_type" text DEFAULT 'multiple' NOT NULL,
	"min_selection" integer DEFAULT 0 NOT NULL,
	"max_selection" integer DEFAULT 99 NOT NULL
);--> statement-breakpoint
CREATE TABLE "modifiers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"group_id" text NOT NULL REFERENCES "modifier_groups"("id") ON DELETE CASCADE,
	"price" bigint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "raw_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sku" text,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"supplier_id" text,
	"tax_percent" integer DEFAULT 0 NOT NULL,
	"hsn_code" text
);--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"yields" text,
	"menu_item_id" text
);--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"recipe_id" text NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
	"material_id" text NOT NULL REFERENCES "raw_materials"("id"),
	"qty" integer NOT NULL,
	"unit" text
);--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone" text,
	"gstin" text
);--> statement-breakpoint
CREATE TABLE "outlet_item_config" (
	"outlet_id" text NOT NULL,
	"source_item_id" text NOT NULL,
	"price" bigint,
	"is_active" boolean,
	"channels" jsonb,
	"tax_override" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_item_config_uidx" ON "outlet_item_config" USING btree ("outlet_id","source_item_id");--> statement-breakpoint
CREATE TABLE "bulk_mapping_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"source_outlet_id" text NOT NULL,
	"target_outlet_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"performed_by" text,
	"mapped" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"result" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "menu_categories_org_outlet_idx" ON "menu_categories" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "menu_items_org_outlet_idx" ON "menu_items" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "menu_variants_org_outlet_idx" ON "menu_variants" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "menu_variants_item_idx" ON "menu_variants" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_org_outlet_idx" ON "modifier_groups" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "modifiers_org_outlet_idx" ON "modifiers" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "modifiers_group_idx" ON "modifiers" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "raw_materials_org_outlet_idx" ON "raw_materials" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "raw_materials_supplier_idx" ON "raw_materials" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "recipes_org_outlet_idx" ON "recipes" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "suppliers_org_outlet_idx" ON "suppliers" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "bulk_mapping_runs_org_idx" ON "bulk_mapping_runs" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "occupancy_groups" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "kots" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "kot_lines" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "inventory_txns" ADD COLUMN "organization_id" text;--> statement-breakpoint
UPDATE "floors" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = floors.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "tables" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = tables.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "occupancy_groups" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = occupancy_groups.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "orders" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = orders.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "order_items" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = order_items.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "kots" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = kots.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "kot_lines" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = kot_lines.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "payments" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = payments.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "refunds" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = refunds.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "customers" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = customers.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
UPDATE "inventory_txns" SET organization_id = (SELECT organization_id FROM outlets WHERE outlets.id = inventory_txns.outlet_id LIMIT 1) WHERE organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "floors_org_outlet_idx" ON "floors" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "tables_org_outlet_idx" ON "tables" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "orders_org_outlet_idx" ON "orders" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "kots_org_outlet_idx" ON "kots" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "payments_org_outlet_idx" ON "payments" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "customers_org_outlet_idx" ON "customers" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE INDEX "inventory_txns_org_outlet_idx" ON "inventory_txns" USING btree ("organization_id","outlet_id")
