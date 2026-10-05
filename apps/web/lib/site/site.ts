/**
 * Conversion funnel config. All account creation, authentication and
 * subscription binding happen in apps/web (Better Auth + central singleton
 * `user` table: User → Subscriptions → Outlets). This site holds NO auth,
 * NO database, NO user endpoints — every CTA hands off to the app.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const TRIAL_QUERY = "trial=14d";

export function signUpUrl(plan?: string): string {
  // Direct to the app — no registration form on this site. The app reads
  // trial/plan and routes new users through /onboarding.
  const params = new URLSearchParams({ trial: "14d" });
  if (plan) params.set("plan", plan);
  return `${APP_URL}/auth/sign-up?${params.toString()}`;
}

export function signInUrl(): string {
  return `${APP_URL}/auth/sign-in`;
}
