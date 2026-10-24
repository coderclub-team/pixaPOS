DROP INDEX "outlets_code_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_org_code_uidx" ON "outlets" USING btree ("organization_id","code");