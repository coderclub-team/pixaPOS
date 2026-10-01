# Local domain runbook: `localhost:3000` <-> `https://local.pixapos.store`

One dev server at a time — both scripts share the `.next` lock, so each
auto-stops the other via its `predev*` hook. No sudo needed on this Mac
(non-root can bind 443 here); never run the dev server under `sudo` —
root-owned files in `.next` wedge every later start.

## Everyday dev (default)

```bash
cd /Users/arul/Projects/pixaPOS
pnpm dev:web                  # http://localhost:3000
```

`BETTER_AUTH_URL=http://localhost:3000` in `apps/web/.env.local`.

## Migrate to the local domain (when asked)

```bash
cd /Users/arul/Projects/pixaPOS
./update-local-host.sh         # re-points local.pixapos.store at current Wi-Fi IP
```

If the Wi-Fi network changed since last time, that script is the entire
DNS fix (hosts entry + `dscacheutil -flushcache` + mDNSResponder reload).

```bash
# 1. Flip auth origin (takes effect at next boot):
#    apps/web/.env.local  ->  BETTER_AUTH_URL=https://local.pixapos.store
sed -i '' 's|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=https://local.pixapos.store|' apps/web/.env.local

# 2. Boot the HTTPS server (pre-hook stops :3000 automatically):
pnpm --filter @pixa/web dev:https
```

Then verify before opening Chrome:

```bash
curl -s -o /dev/null -w "strict:%{http_code} verify=%{ssl_verify_result}\n" \
  --max-time 15 https://local.pixapos.store/pos
# want: strict:307 verify=0
```

Chrome first visit: `chrome://restart` once (drops the cached cert verdict),
or trust permanently — already done via the mkcert CA in the System keychain.

## Migrate back to localhost

```bash
sed -i '' 's|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=http://localhost:3000|' apps/web/.env.local
pnpm dev:web
```

## If a server goes deaf (port bound, nothing answers)

```bash
lsof -nP -iTCP:443 -sTCP:LISTEN   # empty = deaf; kill + restart
pkill -f "next dev"; sleep 2
# if it still won't boot: root-owned cache from an old sudo run —
sudo rm -rf apps/web/.next       # pure build cache, regenerates
```

## Already in place (do not redo)

- `apps/web/certificates/local.{key,crt}` — mkcert CA-signed for
  `local.pixapos.store`, `*.local.pixapos.store`, `localhost`, `127.0.0.1`,
  `10.99.120.225`; CA trusted in System keychain (`TrustRoot` for SSL).
- `lib/auth.ts` `trustedOrigins` covers localhost:3000 + local.pixapos.store.
- `next.config.js` `allowedDevOrigins` covers the domain (HMR).
- Google OAuth needs `https://local.pixapos.store/api/auth/callback/google`
  in Cloud Console redirect URIs — manual step, per Google project.
- Google NEVER allows a LAN/private IP as an OAuth redirect URI
  (`https://192.168.x.x/...` always ends in `Error 400: invalid_request`).
  Staff on other LAN devices must open the **domain**, never the raw IP.
  Email/password sign-in works on the IP; Google sign-in does not.
