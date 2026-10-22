/**
 * Test-database helper for integration tests.
 *
 * Safety model (fail-closed):
 * - Requires DATABASE_URL_TEST. Never falls back to DATABASE_URL.
 * - Refuses to run when DATABASE_URL_TEST equals DATABASE_URL.
 * - Refuses unless the target database name looks like a test database
 *   (contains "test"), unless PIXA_TEST_ALLOW_ANY_DB=true is set explicitly.
 *
 * Isolation: `resetTestDb()` TRUNCATEs all app tables (CASCADE) so each
 * test file starts from a clean slate. Call it in beforeEach/beforeAll.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../packages/db/schema";
import * as authSchema from "../../packages/db/auth-schema";
import * as saasSchema from "../../packages/db/saas-schema";

const fullSchema = { ...schema, ...authSchema, ...saasSchema };

function testDatabaseName(url: string): string {
  const withoutQuery = url.split("?")[0];
  const lastSlash = withoutQuery.lastIndexOf("/");
  return decodeURIComponent(withoutQuery.slice(lastSlash + 1));
}

export function requireTestDatabaseUrl(): string {
  const testUrl = (process.env.DATABASE_URL_TEST ?? "").trim();
  if (!testUrl) {
    throw new Error(
      "DATABASE_URL_TEST is not set. Integration tests refuse to run without an explicit test database — they never touch DATABASE_URL.",
    );
  }
  const prodUrl = (process.env.DATABASE_URL ?? "").trim();
  if (prodUrl && testUrl === prodUrl) {
    throw new Error(
      "DATABASE_URL_TEST equals DATABASE_URL. Refusing to run tests against the production database.",
    );
  }
  const dbName = testDatabaseName(testUrl).toLowerCase();
  if (!dbName.includes("test") && process.env.PIXA_TEST_ALLOW_ANY_DB !== "true") {
    throw new Error(
      `DATABASE_URL_TEST database "${dbName}" does not look like a test database. ` +
        `Use a database with "test" in its name or set PIXA_TEST_ALLOW_ANY_DB=true.`,
    );
  }
  return testUrl;
}

let cached: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;
let pool: Pool | null = null;

function testPool(): Pool {
  if (!pool) {
    // Mirror createDbPool: verify-full silences pg's libpq-compat warning.
    const url = requireTestDatabaseUrl().replace(
      /([?&])sslmode=require(&|$)/,
      "$1sslmode=verify-full$2",
    );
    pool = new Pool({ connectionString: url, max: 5 });
    pool.on("error", (err) => {
      console.error("[test db] idle pool client error", err instanceof Error ? err.message : err);
    });
  }
  return pool;
}

/** Drizzle client bound to the test database. Throws unless guards pass. */
export function getTestDb() {
  if (!cached) {
    cached = drizzle(testPool(), { schema: fullSchema });
  }
  return cached;
}

// Child-first order; CASCADE makes this belt-and-braces.
const TRUNCATE_TABLES = [
  "attendance_days",
  "crm_enquiries",
  "crm_followups",
  "crm_ticket_notes",
  "crm_tickets",
  "customers",
  "msg_outbox",
  "msg_providers",
  "msg_templates",
  "org_usage",
  "outlet_menu_categories",
  "outlet_menu_items",
  "outlet_modifier_groups",
  "outlet_raw_materials",
  "outlet_recipes",
  "outlet_suppliers",
  "role_permission_overrides",
  "saas_audit",
  "saas_leads",
  "saas_owner_roles",
  "saas_owner_sessions",
  "saas_owners",
  "saas_plans",
  "purchase_items",
  "purchase_order_items",
  "recipe_ingredients",
  "kot_lines",
  "order_items",
  "refunds",
  "payments",
  "kots",
  "orders",
  "purchases",
  "purchase_orders",
  "occupancy_groups",
  "tables",
  "floors",
  "devices",
  "inventory_txns",
  "events",
  "menu_variants",
  "menu_items",
  "menu_categories",
  "payroll_incentives",
  "payroll_items",
  "payroll_runs",
  "leave_requests",
  "leave_balances",
  "public_holidays",
  "holiday_pay_rules",
  "pay_periods",
  "leave_types",
  "employees",
  "modifiers",
  "modifier_groups",
  "raw_materials",
  "recipes",
  "suppliers",
  "outlet_item_config",
  "bulk_mapping_runs",
  "outlet_kitchen_stations",
  "outlet_members",
  "notification_preferences",
  "outlets",
  "applied_commands",
  "invitation",
  "member",
  "account",
  "session",
  "verification",
  "org_profiles",
  "organization",
  "user",
];

/** Wipe all app data in the test database. Safe only via the guards above. */
export async function resetTestDb(): Promise<void> {
  requireTestDatabaseUrl();
  await testPool().query(
    `TRUNCATE TABLE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
  );
}

/** Unique test-scoped id prefix to avoid cross-test collisions. */
export function testId(prefix: string): string {
  return `${prefix}_test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
