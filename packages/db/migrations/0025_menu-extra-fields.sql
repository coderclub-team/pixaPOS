ALTER TABLE "menu_items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "spice_level" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "prep_time_min" integer;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "allergens" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "tax_type" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "nutrition" jsonb;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "pairs_well_with" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "is_bestseller" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modifiers" ADD COLUMN "alias" text;