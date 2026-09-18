/**
 * kdsfeed — KDS live feed (Neon Function).
 *
 * POS/KDS tabs POST lightweight ticket events here; subscribed wallboards get
 * them over SSE instead of polling. Cross-isolate fan-out goes through
 * Postgres (kds_feed table): each isolate polls past its cursor and pushes to
 * its own sockets. Polling the board stays as the offline fallback.
 *
 * Auth: shared secret (KDS_FEED_SECRET). Browser EventSource cannot set
 * headers, so SSE authenticates with ?token=. POST requires Bearer.
 *
 * Deploy: bundled esbuild ESM + zip via the Neon functions deploy API
 * (see docs/adr/0018-kds-live-feed.md). Runs on Node.js 24, pool max 5.
 */
import { Hono } from "hono";
import { Pool } from "pg";
import { attachDatabasePool } from "@neon/functions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

const SECRET = process.env.KDS_FEED_SECRET ?? "";
const POLL_MS = 1000;
const HEARTBEAT_MS = 25_000;

const app = new Hono();

function authed(token: string | null): boolean {
  return !!SECRET && !!token && token === SECRET;
}

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

type FeedRow = { id: number; kind: string; payload: string; created_at: string };

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kds_feed (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS kds_feed_id_idx ON kds_feed (id)`);
}

let ready: Promise<void> | null = null;
function ensureReady() {
  if (!ready)
    ready = ensureTable().catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

app.options(
  "/*",
  (c) => new Response(null, { status: 204, headers: cors(c.req.header("origin")) }),
);

// Publish a feed event (POS tabs call this fire-and-forget after KOT mutations).
app.post("/publish", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  if (!authed(auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null)) {
    return c.text("Unauthorized", 401, cors(c.req.header("origin")));
  }
  await ensureReady();
  const body = await c.req.json<{ kind?: string; payload?: unknown }>().catch(() => ({}));
  const kind = typeof body.kind === "string" && body.kind.length <= 64 ? body.kind : "kot";
  await pool.query("INSERT INTO kds_feed (kind, payload) VALUES ($1, $2)", [
    kind,
    JSON.stringify(body.payload ?? {}),
  ]);
  return c.json({ ok: true }, 201, cors(c.req.header("origin")));
});

// Live stream: polls kds_feed past ?cursor=, pushes rows + heartbeat.
app.get("/stream", async (c) => {
  const url = new URL(c.req.url);
  if (!authed(url.searchParams.get("token"))) {
    return c.text("Unauthorized", 401, cors(c.req.header("origin")));
  }
  await ensureReady();
  let cursor = Number(url.searchParams.get("cursor") ?? 0) || 0;
  try {
    const seed = await pool.query("SELECT coalesce(max(id),0)::text AS id FROM kds_feed");
    const max = Number(seed.rows[0]?.id ?? 0);
    if (cursor <= 0 || cursor > max) cursor = max;
  } catch {
    cursor = 0;
  }
  const origin = c.req.header("origin");
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: {"cursor":${cursor}}\n\n`));
      const poll = async () => {
        if (closed) return;
        try {
          const { rows } = await pool.query<FeedRow>(
            "SELECT id, kind, payload FROM kds_feed WHERE id > $1 ORDER BY id LIMIT 50",
            [cursor],
          );
          for (const row of rows) {
            cursor = Number(row.id);
            controller.enqueue(
              encoder.encode(
                `event: ${row.kind}\ndata: ${JSON.stringify({ id: cursor, payload: JSON.parse(row.payload) })}\n\n`,
              ),
            );
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`event: error\ndata: {"message":"poll failed"}\n\n`));
        }
      };
      timer = setInterval(() => void poll(), POLL_MS);
      beat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, HEARTBEAT_MS);
      await poll();
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
      if (beat) clearInterval(beat);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...cors(origin),
    },
  });
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;
