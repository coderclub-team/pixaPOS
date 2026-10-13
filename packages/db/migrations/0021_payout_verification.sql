ALTER TABLE "employees" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_ifsc_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_ifsc_bank" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "upi_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "upi_holder_name" text;