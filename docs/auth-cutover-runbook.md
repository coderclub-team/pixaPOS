# Better Auth Cutover Runbook (fresh start)

Applies to the `feat/auth-better-auth` cutover and any fresh environment.

## 1. Database

Auth tables migrate with the standard flow (`drizzle-kit migrate`). For an
isolated check, migrate a Neon branch first (`neon-postgres-branches` skill).

## 2. Environment (Vercel + local)

- Remove: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_CLERK_API_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`,
  `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`,
  `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`.
- Set: `BETTER_AUTH_SECRET` (32+ random bytes), `BETTER_AUTH_URL`
  (deployed origin, e.g. `https://pixapos-web-*.vercel.app`).
- Google OAuth: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, and register
  every app origin + `/api/auth/callback/google` as an authorized redirect URI
  in Google Cloud Console (localhost, production, and each preview URL under
  test).
- Never set `NEXT_PUBLIC_PIXAPOS_DEV_BYPASS` outside local dev.

## 3. First org + owner

1. Sign up at `/auth/sign-up` (first user).
2. Create the outlet workspace at `/dashboard/workspaces`.
3. The creator is `owner` (full access). Invite staff from
   `/dashboard/workspaces/team` with their role; they sign up with the same
   email, then confirm their role on the team page.
4. Verify: roles page (`/dashboard/roles`) lists members + matrix; waste-new
   gate rejects a cashier; nav hides admin items for non-admins.

## 4. Rollback

Cutover is one commit. Revert it to restore Clerk fully (re-add the env vars
and the `@clerk/nextjs` dependency). Auth tables are additive — no data loss
either way.
