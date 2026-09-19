import { z } from "zod";

/**
 * Tier-aware environment schema. APP_ENV selects dev|stage|prod; every tier
 * declares the same keys so promotion never discovers a missing secret.
 * Validated once at boot (import side effect) — fail fast, loudly.
 */
const envSchema = z.object({
  APP_ENV: z.enum(["dev", "stage", "prod"]).default("dev"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be 32+ chars"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a URL"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_PLAN_ID: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_KDS_FEED_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_KDS_FEED_SECRET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT_URL_S3: z.string().optional(),
  AWS_REGION: z.string().optional(),
  PIXA_IMAGE_BUCKET: z.string().default("menu-images"),
  PIXA_SYNC_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  NEXT_PUBLIC_PIXAPOS_DEV_BYPASS: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n${issues.join("\n")}`);
  }
  const env = parsed.data;
  if (env.APP_ENV !== "dev" && env.NEXT_PUBLIC_PIXAPOS_DEV_BYPASS === "true") {
    throw new Error("NEXT_PUBLIC_PIXAPOS_DEV_BYPASS must never be true outside dev");
  }
  if (
    (env.GOOGLE_CLIENT_ID && !env.GOOGLE_CLIENT_SECRET) ||
    (!env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
  ) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together");
  }
  if (
    (env.RAZORPAY_KEY_ID && !env.RAZORPAY_KEY_SECRET) ||
    (!env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)
  ) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set together");
  }
  return env;
}

export const appEnv: AppEnv = loadEnv();

export function isProdTier(): boolean {
  return appEnv.APP_ENV === "prod";
}

export function isStageTier(): boolean {
  return appEnv.APP_ENV === "stage";
}
