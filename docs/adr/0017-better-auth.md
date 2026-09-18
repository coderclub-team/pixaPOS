# ADR-0017: Clerk → self-managed Better Auth

Date: 2026-09-18 · Status: accepted

## Context

Clerk hosted auth + organizations + custom RBAC. Managed Neon Auth cannot
carry our 17 custom `org:*` permissions (organization support is Beta: no
custom roles/permissions), so the target is **self-managed Better Auth**
(organization plugin) on our Vercel host with Postgres on Neon.

## Decisions

1. **Strangler migration on one branch.** Better Auth built alongside Clerk
   (dual-auth shell), surfaces migrated one by one, cutover as a single flip.
   No phase broke the app.
2. **Roles from config.** `ROLE_PERMISSIONS` (config/permissions.ts) compiles
   into Better Auth access-control roles (admin/manager/cashier/waiter/kitchen/
   accountant); org creators hold `owner` with full access. Admin UI
   grants/revokes persist as `role_permission_overrides` layered on the config
   base. Known limitation: runtime `baHas` checks the config base (overrides
   surface in the roles UI; wire them into `baHas` when overrides see real use).
3. **Lazy auth construction.** The Better Auth instance builds on first use so
   build prerender and route collection never require `DATABASE_URL`.
4. **Fresh-start identity.** Auth tables start empty; orgs are re-created and
   staff invited (password hashes cannot transfer by design). No mailer yet —
   invites are created pending; staff sign up with the invited email and an
   admin sets their role.
5. **Phase 2 separation.** Neon Functions migration is a separate branch/PR on
   explicit confirmation — this branch touches identity only.

## Consequences

- `@clerk/nextjs` removed; 7 Clerk env vars replaced by
  `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` (set on Vercel at deploy).
- Auth state lives in our Postgres (`neon_auth` tables) and branches with the
  database — preview branches get isolated identity automatically.
- Custom OAuth (Google/GitHub) is not yet configured; email/password is the
  Day-1 method. Add provider client IDs when needed.
