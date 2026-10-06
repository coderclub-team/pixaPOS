# Single-app subdomains (one Next.js app, one Vercel project)

## 1. Folder / routing structure

All products live in `apps/web/app/`:

```text
app/page.tsx        → marketing site (pixapos.store, www)
app/admin/          → SaaS owner admin (admin.pixapos.store)
app/dashboard/      → restaurant dashboard (app.pixapos.store, + surface cards home)
app/pos/            → POS terminal (pos + captain subdomains)
app/kot/            → KOT (placeholder, like before)
app/kds/            → KDS wallboard
app/kiosk/          → kiosk
app/order/          → online ordering (reuses QR shell; /qr kept for installed PWAs)
app/qr/             → QR ordering (legacy path + manifest)
app/shop/           → e-commerce placeholder (build the storefront here later)
```

## 2–3. Hostname routing (`apps/web/lib/hosts.ts` + `apps/web/proxy.ts`)

- `resolveSurfaceRoute(host)` strips the port, matches the longest known base
  (`pixapos.store`, `dev.pixapos.store`, `local.pixapos.store`, or
  `NEXT_PUBLIC_BASE_DOMAIN`), and maps the single-level subdomain via
  `SURFACE_MAP`. Localhost / IPs / `*.vercel.app` / multi-level / unknown
  hosts return null (no rewrite).
- `proxy.ts` applies the rewrite **only on bare `/`**, then runs the existing
  gates against the *rewritten* pathname — surfaces can never bypass session
  checks. Deep links, assets (`matcher` excludes dotted paths), and API
  routes pass through untouched on every host.

## 4. Environment variables

| Var | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_BASE_DOMAIN` | base domain for parsing (default `pixapos.store`) | `local.pixapos.store` locally |
| `NEXT_PUBLIC_APP_URL` | canonical app origin for CTAs/emails | `https://app.pixapos.store` |
| `BETTER_AUTH_URL` | auth canonical origin | `https://app.pixapos.store` |
| `COOKIE_DOMAIN` | parent-domain session cookies (prod only) | `.pixapos.store` |
| `PLATFORM_OWNER_EMAILS` | SaaS-owner allowlist (comma-separated) | `owner@pixapos.store` |
| `DATABASE_URL`, `GOOGLE_*` | unchanged | — |

## 5. Vercel (one project)

- Single project (recommended: existing web project), framework Next.js.
- Attach all 9 production domains to it: apex, www, admin, app, pos,
  kot, kds, kiosk, order, shop. Delete/park the old `landing`/`admin`
  projects after cutover. Keep `regions: ["bom1"]`.
- Preview deployments (`*.vercel.app`) intentionally bypass surface routing.
- No wildcard domain needed (explicit list avoids plan issues).

## 6. GoDaddy DNS

- Apex: `A @ → <value shown in Vercel dashboard>` (re-confirm at cutover;
  never hardcode stale infra IPs).
- `CNAME www → cname.vercel-dns.com`, one `CNAME` per subdomain with the
  same target.
- Optional: `CNAME * → cname.vercel-dns.com` for future hosts (explicit
  names keep working with or without it).

## 7. Local development

- `pnpm dev:web` → `http://localhost:3000` (marketing at `/`, surfaces at paths).
- `*.local.pixapos.store` via the existing hosts/dnsmasq flow
  (`scripts/update-local-host.sh`); `allowedDevOrigins` already covers it.
- `dev.pixapos.store` branch deployments behave like production mapping.

## 8. Production deployment

`git push origin develop` → preview; merge to `main` (PR, branch rules) →
production. Verify: all 9 hosts × anon/auth, deep links, unknown subdomain
→ marketing, no redirect loops (rewrites, never redirects).

## 9. Authentication

- Better Auth untouched, one instance. `trustedOrigins` lists all 9 prod
  hosts + `.local`/`.dev` + localhost (explicit, no wildcard).
- `COOKIE_DOMAIN=.pixapos.store` shares one session across subdomains;
  localhost keeps host-only cookies. Google callback canonical:
  `app.pixapos.store/api/auth/callback/google`.
- `/admin` requires session **and** allowlist email (layout gate, every
  request). Hostname is never authorization: data access stays session +
  org-role + outlet scoped; PWA scopes and the offline outbox are unchanged
  (routing layer never touches sync).

## 10. How the mapping works

Request `https://kds.pixapos.store/` → middleware reads `host`,
`resolveSurfaceRoute` returns `/kds` → pathname becomes `/kds` for gating
(session required) → `NextResponse.rewrite` serves the KDS page while the
browser URL stays `https://kds.pixapos.store/`. Unknown host → null → normal
routing serves marketing `/`. No redirects anywhere in the chain.
