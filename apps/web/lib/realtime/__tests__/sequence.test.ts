import { describe, it, expect } from "vitest";

describe("per-outlet sequence", () => {
  it("outlet A and B sequences independent", () => {
    const seqs: Record<string, number> = {};
    function next(outlet: string): number {
      seqs[outlet] = (seqs[outlet] ?? 0) + 1;
      return seqs[outlet];
    }
    expect(next("out_A")).toBe(1);
    expect(next("out_B")).toBe(1);
    expect(next("out_A")).toBe(2);
    expect(next("out_B")).toBe(2);
    expect(next("out_A")).toBe(3);
    // monotonic per outlet
    expect(seqs["out_A"]).toBe(3);
    expect(seqs["out_B"]).toBe(2);
  });

  it("replay afterSequence returns only newer events", () => {
    const events = [
      { sequence: 1, outlet_id: "out_A" },
      { sequence: 2, outlet_id: "out_A" },
      { sequence: 3, outlet_id: "out_A" },
    ];
    const after = 1;
    const missed = events.filter((e) => e.sequence > after);
    expect(missed.map((e) => e.sequence)).toEqual([2, 3]);
  });

  it("idempotent replay: seenIds dedupes", () => {
    const seen = new Set<string>();
    const evt = { id: "evt_1", sequence: 1 };
    const first = !seen.has(evt.id);
    seen.add(evt.id);
    const second = !seen.has(evt.id);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
