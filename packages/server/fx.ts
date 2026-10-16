/**
 * Foreign-exchange helper for internal cost/margin analysis.
 * Live USD→INR from open.er-api.com, cached in-process and at the fetch layer,
 * with an env/hardcoded fallback so the admin view never breaks.
 */
const FALLBACK_RATE = Number(process.env.USD_TO_INR ?? 87);
const TTL_MS = 12 * 60 * 60 * 1000;

let cache: { rate: number; at: number; updatedAt: string | null } | null = null;

export type FxRate = {
  rate: number;
  source: "live" | "fallback";
  updatedAt: string | null;
};

export async function getUsdToInr(): Promise<FxRate> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return { rate: cache.rate, source: "live", updatedAt: cache.updatedAt };
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 43_200 },
    });
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    const rate = data?.rates?.INR;
    if (data?.result === "success" && typeof rate === "number" && rate > 0) {
      cache = { rate, at: now, updatedAt: data.time_last_update_utc ?? null };
      return { rate, source: "live", updatedAt: cache.updatedAt };
    }
  } catch {
    /* fall through to fallback */
  }
  return { rate: FALLBACK_RATE, source: "fallback", updatedAt: null };
}
