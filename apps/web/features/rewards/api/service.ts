import { delay } from "@/constants/mock-api";
import { REWARD_RULES, type RewardEntry, type RewardReason } from "./types";

const REWARD_KEY = "pixaRewards";

let mockEntries: RewardEntry[] = [];
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(REWARD_KEY);
    if (raw) mockEntries = JSON.parse(raw).entries ?? [];
  } catch {}
}

function save() {
  try {
    localStorage.setItem(REWARD_KEY, JSON.stringify({ entries: mockEntries }));
  } catch {}
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
  const pts = Math.floor(grandPaise / REWARD_RULES.earn_paise_per_point);
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
  return { points, value_paise: points * REWARD_RULES.redeem_paise_per_point };
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
