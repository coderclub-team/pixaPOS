/**
 * Conversion funnel config. All account creation, authentication and
 * subscription binding happen in apps/web (Better Auth + central singleton
 * `user` table: User → Subscriptions → Outlets). This site holds NO auth,
 * NO database, NO user endpoints — every CTA hands off to the app.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const TRIAL_QUERY = "trial=14d";

export function signUpUrl(plan?: string): string {
  // In-landing registration first (restaurant profile + lead details),
  // then handoff to the app with prefill params. See app/signup/page.tsx.
  return plan ? `/signup?plan=${encodeURIComponent(plan)}` : "/signup";
}

export function signInUrl(): string {
  return `${APP_URL}/auth/sign-in`;
}
