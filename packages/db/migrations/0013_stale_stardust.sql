ALTER TABLE "outlets" ADD COLUMN "alias" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "type" text DEFAULT 'restaurant' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "alternate_phone" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "address_line_1" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "address_line_2" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "locality" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "country" text DEFAULT 'India';--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "gst_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "pan" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "fssai_number" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "timezone" text DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "locale" text DEFAULT 'en-IN' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "kiosk_pin_hash" text;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
