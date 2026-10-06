# SaaS Owner Runbook

How the singleton SaaS owner signs in, manages the platform, and recovers.
Keep this file in the repo; keep secrets out of it.

## Concepts (30 seconds)

- **SaaS owner ≠ restaurant user.** Owners live in `saas_owners`, sign in at
  `/admin/login` with a separate `pixa_owner` cookie. Restaurant credentials
  never work there, and owner credentials never work on the app — by schema
  design (no shared tables, no shared secrets).
- Exactly **one** super owner exists. Staff get scoped roles. The super owner
  cannot be demoted or deactivated through the UI/API.

## First-time setup (once, ever)

1. Generate the bootstrap token (your machine, not the repo):
   ```bash
   openssl rand -hex 32
   ```
2. Put it in the environment — never in git:
   - Local: `apps/web/.env.local` → `SAAS_SETUP_TOKEN=<hex>`
   - Vercel: project → Settings → Environment Variables → `SAAS_SETUP_TOKEN` (Production)
   - Restart the dev server after editing `.env.local` (env loads at boot).
3. Seed the super owner (single use — the endpoint dies after success):
   ```bash
   curl -X PUT http://localhost:3000/api/admin/auth \
     -H "content-type: application/json" \
     -H "x-setup-token: <hex from step 1>" \
     -d '{"email":"you@yourdomain.com","password":"<12+ characters>"}'
   ```
   - `201 {"ok":true}` → done. The token is now permanently useless.
   - `403 already seeded` → someone already did this; go sign in.
   - `403 forbidden` → token mismatch (check env + server restart).
   - `403 seeding disabled` → server has no `SAAS_SETUP_TOKEN` set.
   - `503` → `DATABASE_URL` missing/unreachable.

## Everyday use

| Task | Where |
|---|---|
| Sign in / out | `/admin/login` (12h sessions, server-revoked on logout) |
| Registration pipeline | `/admin/leads` — review, set status, approve → creates org + trial |
| Organisations | `/admin/organizations` — lifecycle, plan (catalog dropdown), block, MRR |
| Plans & billing | `/admin/billing` — create/edit/activate plans (deactivation blocked while orgs use a plan) |
| Owner users | `/admin/users` — invite staff, assign roles, reset passwords, deactivate |
| Owner roles | `/admin/roles` — scoped permission sets (Support/Billing seeded on first visit) |
| Audit log | `/admin/audit` — every owner action, actor + before/after |

Suspending an org or resetting a password asks for **your own password again**
in the same request (step-up, no TOTP in v1). Changing your own password logs
everyone out.

## If you forget the password

There is no "forgot password" email (v1). Recovery = database access:
someone with Neon access runs a password reset by writing a fresh scrypt hash
to `saas_owners.password_hash` for your row (all sessions for that row should
be deleted from `saas_owner_sessions` at the same time). Guard Neon access
accordingly — it is the ultimate backdoor by design.

## If you lose the setup token

Irrelevant after seeding — the endpoint 403s forever regardless of token.
Only a fresh (empty `saas_owners`) database can ever be seeded.

## Lockout checklist (in order)

1. Wrong route? Login is `POST /api/admin/auth` (page: `/admin/login`). There
   is no GET — it 405s by design.
2. `invalid credentials` on both email and password typos (no enumeration).
3. Restaurant session on `/admin` goes to `/dashboard`; anonymous goes to
   `/admin/login`. Both are correct — only an owner session opens the console.
4. After env changes, restart the dev server (or redeploy prod).

## What never to do

- Never reuse the setup token as a password, and never commit it.
- Never create a second super owner via SQL (breaks the singleton invariant
  the UI enforces; the API refuses it too).
- Never delete rows from `saas_owner_sessions` except during password recovery.
- Never point restaurant support at `/admin/*` — their accounts 403 there by design.
