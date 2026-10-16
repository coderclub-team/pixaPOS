
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"email" text,
	"employee_code" text NOT NULL,
	"pay_type" text NOT NULL,
	"rate_paise" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"bank_account_enc" text,
	"status" text DEFAULT 'active' NOT NULL,
	"joining_date" date
);
--> statement-breakpoint

CREATE TABLE "holiday_pay_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"multiplier" numeric DEFAULT '1.5' NOT NULL,
	"fixed_incentive_paise" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

CREATE TABLE "leave_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"year" integer NOT NULL,
	"opening_balance" numeric NOT NULL,
	"used" numeric DEFAULT '0' NOT NULL,
	"remaining" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "leave_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"employee_id" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_days" numeric NOT NULL,
	"day_type" text DEFAULT 'full' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"remarks" text
);
--> statement-breakpoint

CREATE TABLE "leave_types" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"yearly_quota" numeric NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

CREATE TABLE "pay_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint

CREATE TABLE "payroll_incentives" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"payroll_item_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "payroll_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"payroll_run_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"working_units" numeric DEFAULT '0' NOT NULL,
	"holiday_units" numeric DEFAULT '0' NOT NULL,
	"gross_wage_paise" bigint DEFAULT 0 NOT NULL,
	"holiday_extra_paise" bigint DEFAULT 0 NOT NULL,
	"total_incentives_paise" bigint DEFAULT 0 NOT NULL,
	"unpaid_leave_paise" bigint DEFAULT 0 NOT NULL,
	"gross_pay_paise" bigint DEFAULT 0 NOT NULL,
	"deductions_paise" bigint DEFAULT 0 NOT NULL,
	"net_pay_paise" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "payroll_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"pay_period_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_gross_paise" bigint DEFAULT 0 NOT NULL,
	"total_net_paise" bigint DEFAULT 0 NOT NULL,
	"created_by" text,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE "public_holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text,
	"organization_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint

CREATE INDEX "employees_org_outlet_idx" ON "employees" USING btree ("organization_id","outlet_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "employees_org_code_uidx" ON "employees" USING btree ("organization_id","employee_code");
--> statement-breakpoint

CREATE INDEX "holiday_pay_rules_org_idx" ON "holiday_pay_rules" USING btree ("organization_id");
--> statement-breakpoint

CREATE INDEX "leave_balances_employee_idx" ON "leave_balances" USING btree ("employee_id","year");
--> statement-breakpoint

CREATE UNIQUE INDEX "leave_balances_emp_type_year_uidx" ON "leave_balances" USING btree ("employee_id","leave_type_id","year");
--> statement-breakpoint

CREATE INDEX "leave_requests_org_outlet_idx" ON "leave_requests" USING btree ("organization_id","outlet_id");
--> statement-breakpoint

CREATE INDEX "leave_requests_employee_idx" ON "leave_requests" USING btree ("employee_id","status");
--> statement-breakpoint

CREATE INDEX "leave_types_org_idx" ON "leave_types" USING btree ("organization_id");
--> statement-breakpoint

CREATE INDEX "pay_periods_org_idx" ON "pay_periods" USING btree ("organization_id");
--> statement-breakpoint

CREATE INDEX "payroll_incentives_item_idx" ON "payroll_incentives" USING btree ("payroll_item_id");
--> statement-breakpoint

CREATE INDEX "payroll_items_run_idx" ON "payroll_items" USING btree ("payroll_run_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "payroll_items_run_employee_uidx" ON "payroll_items" USING btree ("payroll_run_id","employee_id");
--> statement-breakpoint

CREATE INDEX "payroll_runs_org_idx" ON "payroll_runs" USING btree ("organization_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "payroll_runs_period_uidx" ON "payroll_runs" USING btree ("pay_period_id");
--> statement-breakpoint

CREATE INDEX "public_holidays_org_idx" ON "public_holidays" USING btree ("organization_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "public_holidays_org_date_uidx" ON "public_holidays" USING btree ("organization_id","date");
