CREATE TABLE "role_permission_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
