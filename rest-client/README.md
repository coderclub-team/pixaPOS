# rest-client

HTTP request collections for manual API testing. Works with the
[VS Code REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
extension or IntelliJ IDEA's built-in HTTP client.

## Layout

```text
rest-client/
  http-client.env.json   # environments (local / develop / prod) + placeholders
  web/
    login.http            # Better Auth flows (sign-up, sign-in, get-session, sign-out)
    me.http               # /api/me and /api/me/outlets
    outlets.http          # outlet list/create/profile update calls
    org.http              # org member listing
    masters.http          # shared master data: categories, items, modifiers, etc.
    menu.http             # menu-focused convenience wrapper around /api/masters/*
```

## Setup

1. Open this repo in VS Code with the REST Client extension installed.
2. Bottom-right status bar: pick an environment (`local` by default).
3. Edit the placeholder values in `http-client.env.json` (`email`, `password`,
   `phone`, `otp`) — or better, export real values as process environment
   variables with the same names; the client prefers real env vars over the
   JSON file, so secrets never have to live in the repo.
4. Click **Send Request** above any request. Cookie sessions
   (`better-auth.session_token`) are captured automatically and reused by the
   requests below it in the same file.

## Notes

- Sign-in / sign-up responses set the session cookie; `get-session` is the
  quick way to confirm you are authenticated.
- Local dev runs at `http://localhost:3000` (already a trusted origin).
- Phone OTP in dev/staging uses the static code from `OTP_STATIC_CODE`
  (see server logs) — no SMS is sent.
- Google OAuth can't be completed from a REST client (browser flow); it is
  intentionally not included here.
