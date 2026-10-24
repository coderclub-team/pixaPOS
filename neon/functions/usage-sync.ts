// Neon scheduled function: forwards to the existing Next.js cron handler.
// Keeps business logic single-source (apps/web/app/api/cron/usage-sync/route.ts)
// — this function is just a trigger adapter.
//
// Trigger: `usage-sync-daily` (0 3 * * * UTC) defined in neon.ts
// Env required (uploaded via `neon deploy --env .env.local`):
//   APP_URL or VERCEL_PROJECT_PRODUCTION_URL — base URL of the deployed app
//   CRON_SECRET — bearer token the route expects (same as Vercel cron)
// On manual trigger the function also responds to GET/POST for `neon functions invoke` testing.

const TARGET_PATH = "/api/cron/usage-sync";

function targetUrl(): string | null {
  const base =
    process.env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";
  if (!base) return null;
  // Allow bare host without protocol (Vercel sometimes gives host only)
  const normalized = base.startsWith("http") ? base : `https://${base}`;
  return `${normalized.replace(/\/$/, "")}${TARGET_PATH}`;
}

async function forward(req: Request): Promise<Response> {
  const url = targetUrl();
  if (!url) {
    return new Response(
      JSON.stringify({ ok: false, error: "APP_URL not configured for usage-sync function" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
  const secret = process.env.CRON_SECRET ?? "";
  const headers: Record<string, string> = {};
  if (secret) headers.authorization = `Bearer ${secret}`;

  // Forward the trigger request as GET (the route handler is GET)
  const res = await fetch(url, { method: "GET", headers });
  const body = await res.text();
  // Always return JSON so `neon logs query --source function` shows the outcome
  const contentType = res.headers.get("content-type") ?? "application/json";
  return new Response(body, {
    status: res.status,
    headers: { "content-type": contentType, "x-trigger-source": "neon-schedule" },
  });
}

// Neon Functions runtime calls `fetch` (WinterCG). Support both GET (schedule) and POST (manual invoke).
export default {
  async fetch(request: Request): Promise<Response> {
    // Allow health check via HEAD
    if (request.method === "HEAD") return new Response(null, { status: 200 });
    try {
      const res = await forward(request);
      // Log to stdout for `neon logs query --source function`
      console.log(
        `[usage-sync] ${request.method} ${new URL(request.url).pathname} -> ${res.status}`,
      );
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[usage-sync] forward failed:", msg);
      return new Response(JSON.stringify({ ok: false, error: msg }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
  },
};
