import { delay } from "@/constants/mock-api";
import { REWARD_RULES, type RewardEntry, type RewardReason, type RewardRules } from "./types";

const REWARD_KEY = "pixaRewards";
const RULES_KEY = "pixaRewardRules";

let mockEntries: RewardEntry[] = [];
let mockRules: RewardRules[] = [];
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(REWARD_KEY);
    if (raw) mockEntries = JSON.parse(raw).entries ?? [];
  } catch {}
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) mockRules = JSON.parse(raw).rules ?? [];
  } catch {}
  // Seed the launch program so history predates any edit.
  if (mockRules.length === 0) {
    mockRules = [
      {
        id: "rr_seed",
        earn_paise_per_point: REWARD_RULES.earn_paise_per_point,
        redeem_paise_per_point: REWARD_RULES.redeem_paise_per_point,
        from_at: "2020-01-01T00:00:00.000Z",
        created_at: new Date().toISOString(),
      },
    ];
    saveRules();
  }
}

function save() {
  try {
    localStorage.setItem(REWARD_KEY, JSON.stringify({ entries: mockEntries }));
  } catch {}
}

function saveRules() {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify({ rules: mockRules }));
  } catch {}
}

/** Rules history, newest first. */
export async function getRewardRules(): Promise<RewardRules[]> {
  await delay(150);
  load();
  return [...mockRules].sort((a, b) => b.from_at.localeCompare(a.from_at));
}

/** Rule active at an instant (default now): latest from_at ≤ at with no/pending end. */
export function activeRulesAt(atISO?: string): RewardRules {
  load();
  const at = atISO ?? new Date().toISOString();
  const hit = [...mockRules]
    .filter((r) => r.from_at <= at && (!r.to_at || at < r.to_at))
    .sort((a, b) => b.from_at.localeCompare(a.from_at))[0];
  return (
    hit ?? {
      id: "rr_fallback",
      earn_paise_per_point: REWARD_RULES.earn_paise_per_point,
      redeem_paise_per_point: REWARD_RULES.redeem_paise_per_point,
      from_at: "2020-01-01T00:00:00.000Z",
      created_at: at,
    }
  );
}

/**
 * New program version: from defaults to now, to is optional. The previous
 * open rule auto-closes at the new from (its to_at = new from_at), so
 * exactly one rule is ever open-ended.
 */
export async function createRewardRules(payload: {
  earn_paise_per_point: number;
  redeem_paise_per_point: number;
  from_at?: string;
  to_at?: string;
}): Promise<RewardRules> {
  await delay(400);
  load();
  if (!(payload.earn_paise_per_point > 0) || !Number.isFinite(payload.earn_paise_per_point))
    throw new Error("Earn rate must be positive (paise per point)");
  if (!(payload.redeem_paise_per_point > 0) || !Number.isFinite(payload.redeem_paise_per_point))
    throw new Error("Redeem value must be positive (paise per point)");
  const from = payload.from_at ?? new Date().toISOString();
  if (Number.isNaN(new Date(from).getTime())) throw new Error("Invalid from date");
  const to = payload.to_at || undefined;
  if (to) {
    if (Number.isNaN(new Date(to).getTime())) throw new Error("Invalid to date");
    if (new Date(to) <= new Date(from)) throw new Error("To must be after from");
  }
  // Auto-close: any rule open across the new from ends there.
  for (const r of mockRules) {
    if (r.from_at < from && (!r.to_at || r.to_at > from)) r.to_at = from;
  }
  const now = new Date().toISOString();
  const rule: RewardRules = {
    id: `rr_${Date.now().toString(36)}`,
    earn_paise_per_point: Math.round(payload.earn_paise_per_point),
    redeem_paise_per_point: Math.round(payload.redeem_paise_per_point),
    from_at: from,
    to_at: to,
    created_at: now,
  };
  mockRules.push(rule);
  saveRules();
  return { ...rule };
}

export async function rewardBalance(customerId: string): Promise<number> {
  await delay(100);
  load();
  return mockEntries
    .filter((e) => e.customer_id === customerId)
    .reduce((s, e) => s + e.delta_points, 0);
}

export async function rewardLedger(customerId: string): Promise<RewardEntry[]> {
  await delay(150);
  load();
  return mockEntries
    .filter((e) => e.customer_id === customerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function append(
  customerId: string,
  delta: number,
  reason: RewardReason,
  orderId?: string,
  note?: string,
): Promise<RewardEntry> {
  load();
  const balance =
    mockEntries
      .filter((e) => e.customer_id === customerId)
      .reduce((s, e) => s + e.delta_points, 0) + delta;
  if (balance < 0) throw new Error("Insufficient reward points");
  const entry: RewardEntry = {
    id: `rw_${Date.now().toString(36)}`,
    customer_id: customerId,
    order_id: orderId,
    delta_points: delta,
    balance_after: balance,
    reason,
    note,
    created_at: new Date().toISOString(),
  };
  mockEntries.push(entry);
  save();
  return entry;
}

/** Earn on completion: 1 pt per ₹10 of the settled bill. Idempotent per order. */
export async function earnForOrder(
  customerId: string,
  orderId: string,
  grandPaise: number,
): Promise<number> {
  await delay(100);
  load();
  if (
    mockEntries.some(
      (e) => e.customer_id === customerId && e.order_id === orderId && e.reason === "earn",
    )
  ) {
    return 0;
  }
  const rules = activeRulesAt();
  const pts = Math.floor(grandPaise / rules.earn_paise_per_point);
  if (pts <= 0) return 0;
  await append(customerId, pts, "earn", orderId, `Earned on bill`);
  return pts;
}

/** Redeem against a draft bill — returns paise value. Caller applies discount. */
export async function redeemForOrder(
  customerId: string,
  orderId: string,
  points: number,
): Promise<{ points: number; value_paise: number }> {
  await delay(150);
  load();
  if (!Number.isInteger(points) || points <= 0)
    throw new Error("Points must be a positive integer");
  // One live redemption per order — re-apply replaces.
  mockEntries = mockEntries.filter(
    (e) => !(e.customer_id === customerId && e.order_id === orderId && e.reason === "redeem"),
  );
  const entry = await append(customerId, -points, "redeem", orderId, "Redeemed on bill");
  void entry;
  return { points, value_paise: points * activeRulesAt().redeem_paise_per_point };
}

/** Void an order's redemption (promo/manual replaced it, or removed). */
export async function voidRedemptionForOrder(orderId: string): Promise<void> {
  load();
  const doomed = mockEntries.filter((e) => e.order_id === orderId && e.reason === "redeem");
  for (const d of doomed) {
    await append(d.customer_id, -d.delta_points, "void", orderId, "Redemption replaced");
  }
}

export async function rewardsOutstanding(): Promise<{ members: number; points: number }> {
  await delay(150);
  load();
  const byCustomer = new Map<string, number>();
  for (const e of mockEntries)
    byCustomer.set(e.customer_id, (byCustomer.get(e.customer_id) ?? 0) + e.delta_points);
  let points = 0;
  let members = 0;
  for (const b of byCustomer.values()) {
    if (b > 0) {
      members++;
      points += b;
    }
  }
  return { members, points };
}
