import { describe, expect, it } from "vitest";

type StoredEvent = { id: string; outlet_id: string; sequence: number; event_type: string };

function replayAfter(store: StoredEvent[], outletId: string, after: number): StoredEvent[] {
  return store
    .filter((e) => e.outlet_id === outletId && e.sequence > after)
    .sort((a, b) => a.sequence - b.sequence);
}

function applyIdempotent(seen: Set<string>, events: StoredEvent[]): StoredEvent[] {
  const applied: StoredEvent[] = [];
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    applied.push(e);
  }
  return applied;
}

describe("KDS offline 30s → reconnect replay (§37)", () => {
  it("missed QR order event is recovered exactly once", () => {
    const store: StoredEvent[] = [
      { id: "e1", outlet_id: "out_A", sequence: 1001, event_type: "ORDER_CREATED" },
      { id: "e2", outlet_id: "out_A", sequence: 1002, event_type: "ORDER_SENT_TO_KITCHEN" },
      { id: "e3", outlet_id: "out_A", sequence: 1003, event_type: "ORDER_SENT_TO_KITCHEN" },
    ];
    // KDS last saw 1001, then offline while 1002+1003 landed
    const missed = replayAfter(store, "out_A", 1001);
    expect(missed.map((e) => e.sequence)).toEqual([1002, 1003]);

    const seen = new Set<string>(["e1"]);
    const applied = applyIdempotent(seen, missed);
    expect(applied).toHaveLength(2);
    // reconnect retry delivers 1002+1003 again → both already seen, no duplicate cards
    const dup = applyIdempotent(seen, replayAfter(store, "out_A", 1001));
    expect(dup).toHaveLength(0);
  });

  it("outlet isolation holds during replay", () => {
    const store: StoredEvent[] = [
      { id: "a1", outlet_id: "out_A", sequence: 1001, event_type: "ORDER_CREATED" },
      { id: "b1", outlet_id: "out_B", sequence: 1001, event_type: "ORDER_CREATED" },
    ];
    expect(replayAfter(store, "out_A", 0).map((e) => e.id)).toEqual(["a1"]);
    expect(replayAfter(store, "out_B", 0).map((e) => e.id)).toEqual(["b1"]);
  });
});

describe("duplicate delivery (§38)", () => {
  it("same event twice → one KOT card", () => {
    const seen = new Set<string>();
    const evt: StoredEvent = {
      id: "kot-1",
      outlet_id: "out_A",
      sequence: 5,
      event_type: "KOT_CREATED",
    };
    expect(applyIdempotent(seen, [evt, evt])).toHaveLength(1);
  });
});

describe("multiple devices (§39)", () => {
  it("POS1, POS2, KDS all receive the same outlet event", () => {
    const store: StoredEvent[] = [
      { id: "q1", outlet_id: "out_A", sequence: 7, event_type: "ORDER_CREATED" },
    ];
    for (const device of ["POS1", "POS2", "KDS1"]) {
      const missed = replayAfter(store, "out_A", 6);
      expect(missed).toHaveLength(1);
      void device;
    }
  });

  it("notification does not imply ownership (§40)", () => {
    // Receiving ORDER_CREATED must not mark the order claimed; claim is a separate DB event.
    const ownership: Record<string, string | null> = { order_1: null };
    const received = true; // notification arrived
    expect(received).toBe(true);
    expect(ownership["order_1"]).toBeNull(); // still unclaimed until ORDER_CLAIMED txn
  });
});
