CREATE TABLE "floor_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"floor_id" text NOT NULL,
	"kind" text NOT NULL,
	"shape_variant" text,
	"label" text,
	"x_mm" integer DEFAULT 0 NOT NULL,
	"y_mm" integer DEFAULT 0 NOT NULL,
	"w_mm" integer DEFAULT 0 NOT NULL,
	"h_mm" integer DEFAULT 0 NOT NULL,
	"rotation_deg" integer DEFAULT 0 NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL,
	"color" text
);
--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "is_outdoor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "width_mm" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "height_mm" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "grid_size_mm" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "background_color" text;--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "background_image_url" text;--> statement-breakpoint
CREATE INDEX "floor_objects_floor_idx" ON "floor_objects" USING btree ("floor_id");