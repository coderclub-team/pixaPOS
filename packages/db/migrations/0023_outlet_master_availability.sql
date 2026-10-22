CREATE TABLE "outlet_menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_modifier_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_raw_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outlet_menu_categories" ADD CONSTRAINT "outlet_menu_categories_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_menu_items" ADD CONSTRAINT "outlet_menu_items_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_modifier_groups" ADD CONSTRAINT "outlet_modifier_groups_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_raw_materials" ADD CONSTRAINT "outlet_raw_materials_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_recipes" ADD CONSTRAINT "outlet_recipes_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_suppliers" ADD CONSTRAINT "outlet_suppliers_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_menu_categories_uidx" ON "outlet_menu_categories" USING btree ("outlet_id","entity_id");--> statement-breakpoint
CREATE INDEX "outlet_menu_categories_outlet_idx" ON "outlet_menu_categories" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_menu_categories_entity_idx" ON "outlet_menu_categories" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_menu_items_uidx" ON "outlet_menu_items" USING btree ("outlet_id","entity_id");--> statement-breakpoint
CREATE INDEX "outlet_menu_items_outlet_idx" ON "outlet_menu_items" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_menu_items_entity_idx" ON "outlet_menu_items" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_modifier_groups_uidx" ON "outlet_modifier_groups" USING btree ("outlet_id","entity_id");--> statement-breakpoint
CREATE INDEX "outlet_modifier_groups_outlet_idx" ON "outlet_modifier_groups" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_modifier_groups_entity_idx" ON "outlet_modifier_groups" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_raw_materials_uidx" ON "outlet_raw_materials" USING btree ("outlet_id","entity_id");--> statement-breakpoint
CREATE INDEX "outlet_raw_materials_outlet_idx" ON "outlet_raw_materials" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_raw_materials_entity_idx" ON "outlet_raw_materials" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_recipes_uidx" ON "outlet_recipes" USING btree ("outlet_id","entity_id");--> statement-breakpoint
CREATE INDEX "outlet_recipes_outlet_idx" ON "outlet_recipes" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_recipes_entity_idx" ON "outlet_recipes" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_suppliers_uidx" ON "outlet_suppliers" USING btree ("outlet_id","entity_id");--> statement-breakpoint
CREATE INDEX "outlet_suppliers_outlet_idx" ON "outlet_suppliers" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_suppliers_entity_idx" ON "outlet_suppliers" USING btree ("entity_id");--> statement-breakpoint
-- Backfill: every existing master is available at every outlet of its org.
-- Preserves pre-mapping behavior (everything visible everywhere).
INSERT INTO "outlet_menu_categories" ("id", "organization_id", "outlet_id", "entity_id")
SELECT gen_random_uuid()::text, c."organization_id", o."id", c."id"
FROM "menu_categories" c JOIN "outlets" o ON o."organization_id" = c."organization_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "outlet_menu_items" ("id", "organization_id", "outlet_id", "entity_id")
SELECT gen_random_uuid()::text, i."organization_id", o."id", i."id"
FROM "menu_items" i JOIN "outlets" o ON o."organization_id" = i."organization_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "outlet_modifier_groups" ("id", "organization_id", "outlet_id", "entity_id")
SELECT gen_random_uuid()::text, g."organization_id", o."id", g."id"
FROM "modifier_groups" g JOIN "outlets" o ON o."organization_id" = g."organization_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "outlet_recipes" ("id", "organization_id", "outlet_id", "entity_id")
SELECT gen_random_uuid()::text, r."organization_id", o."id", r."id"
FROM "recipes" r JOIN "outlets" o ON o."organization_id" = r."organization_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "outlet_raw_materials" ("id", "organization_id", "outlet_id", "entity_id")
SELECT gen_random_uuid()::text, m."organization_id", o."id", m."id"
FROM "raw_materials" m JOIN "outlets" o ON o."organization_id" = m."organization_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "outlet_suppliers" ("id", "organization_id", "outlet_id", "entity_id")
SELECT gen_random_uuid()::text, s."organization_id", o."id", s."id"
FROM "suppliers" s JOIN "outlets" o ON o."organization_id" = s."organization_id"
ON CONFLICT DO NOTHING;
