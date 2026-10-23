ALTER TABLE "menu_categories" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "available_channels" jsonb DEFAULT '["dine_in","pickup","delivery","zomato","swiggy","ondc"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_variants" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "menu_variants" ADD COLUMN "qty" numeric;--> statement-breakpoint
ALTER TABLE "menu_variants" ADD COLUMN "unit" text;