CREATE TABLE "attendance_days" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"employee_id" text NOT NULL,
	"date" date NOT NULL,
	"status" text DEFAULT 'present' NOT NULL,
	"hours" numeric DEFAULT '0' NOT NULL,
	"marked_by" text,
	"marked_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_days_org_date_idx" ON "attendance_days" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "attendance_days_employee_idx" ON "attendance_days" USING btree ("employee_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_days_org_emp_date_uidx" ON "attendance_days" USING btree ("organization_id","employee_id","date");