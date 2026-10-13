DROP INDEX IF EXISTS "menu_categories_org_outlet_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "menu_items_org_outlet_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "menu_variants_org_outlet_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "modifier_groups_org_outlet_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "modifiers_org_outlet_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "raw_materials_org_outlet_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "recipes_org_outlet_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "suppliers_org_outlet_idx";--> statement-breakpoint
ALTER TABLE "menu_categories" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
ALTER TABLE "menu_variants" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
ALTER TABLE "modifier_groups" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
ALTER TABLE "modifiers" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
ALTER TABLE "raw_materials" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "outlet_id";--> statement-breakpoint
CREATE INDEX "menu_categories_org_idx" ON "menu_categories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "menu_items_org_idx" ON "menu_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "menu_variants_org_idx" ON "menu_variants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_org_idx" ON "modifier_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "modifiers_org_idx" ON "modifiers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "raw_materials_org_idx" ON "raw_materials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "recipes_org_idx" ON "recipes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "suppliers_org_idx" ON "suppliers" USING btree ("organization_id");
