CREATE TABLE "outlet_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "outlet_members_outlet_idx" ON "outlet_members" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outlet_members_user_idx" ON "outlet_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_members_outlet_user_uidx" ON "outlet_members" USING btree ("outlet_id","user_id");
