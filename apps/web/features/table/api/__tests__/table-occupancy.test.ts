/**
 * Table + occupancy workflow tests (workflows.md §5).
 *
 * Seating, capacity/sharing guards, release → cleaning → available, and
 * illegal status transitions. The SQLite mirror is stubbed; module state
 * resets per test. Every command carries an explicit outlet ctx so the
 * tests never depend on ambient outlet selection.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const OUTLET_ID = "outlet_test_tables";
const CTX = { outlet_id: OUTLET_ID, actor_id: "staff_1" } as never;

type TableApi = typeof import("@/features/table/api/service");

let tables: TableApi;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  tables = await import("@/features/table/api/service");
});

async function makeTable(overrides: Record<string, unknown> = {}) {
  return tables.createTable({
    outlet_id: OUTLET_ID,
    floor_id: "floor_1",
    number: `T${Math.floor(Math.random() * 100000)}`,
    code: `T${Math.floor(Math.random() * 100000)}`,
    capacity: 4,
    ...overrides,
  } as never);
}

describe("createTable", () => {
  it("starts AVAILABLE and rejects duplicate codes per outlet", async () => {
    const t = await makeTable({ number: "T1", code: "T1" });
    expect(t.status).toBe("available");
    await expect(makeTable({ number: "T1B", code: "T1" })).rejects.toThrow(
      'Table code "T1" already exists in this outlet',
    );
  });

  it("refuses cross-outlet moves", async () => {
    const t = await makeTable();
    await expect(tables.updateTable(t.id, { outlet_id: "outlet_other" } as never)).rejects.toThrow(
      "Table cannot move across outlets",
    );
  });
});

describe("seatOccupancy", () => {
  it("seats a party and marks the table occupied", async () => {
    const t = await makeTable();
    const g = await tables.seatOccupancy({ table_id: t.id, seats: 2, ctx: CTX });
    expect(g.status).toMatch(/SEATED|ORDERING/);
    expect((await tables.getTableById(t.id))?.status).toBe("occupied");
  });

  it("rejects over-capacity parties", async () => {
    const t = await makeTable();
    await expect(tables.seatOccupancy({ table_id: t.id, seats: 6, ctx: CTX })).rejects.toThrow(
      "Insufficient capacity. Only 4 seats available.",
    );
  });

  it("rejects a second party on a non-sharing table", async () => {
    const t = await makeTable();
    await tables.seatOccupancy({ table_id: t.id, seats: 2, ctx: CTX });
    await expect(tables.seatOccupancy({ table_id: t.id, seats: 1, ctx: CTX })).rejects.toThrow(
      "Table does not allow sharing",
    );
  });

  it("shares capacity across parties on a sharing table (ADR-0013)", async () => {
    const t = await makeTable({ allows_sharing: true });
    const a = await tables.seatOccupancy({ table_id: t.id, seats: 2, ctx: CTX });
    const b = await tables.seatOccupancy({ table_id: t.id, seats: 2, ctx: CTX });
    expect(a.label).not.toBe(b.label);
    await expect(tables.seatOccupancy({ table_id: t.id, seats: 1, ctx: CTX })).rejects.toThrow(
      "Insufficient capacity. Only 0 seats available.",
    );
  });

  it("validates the seat count", async () => {
    const t = await makeTable();
    await expect(tables.seatOccupancy({ table_id: t.id, seats: 0, ctx: CTX })).rejects.toThrow(
      "Seats must be a positive integer",
    );
  });
});

describe("release → cleaning → available", () => {
  it("releases with a reason and returns via markCleaned", async () => {
    const t = await makeTable();
    const g = await tables.seatOccupancy({ table_id: t.id, seats: 2, ctx: CTX });
    await expect(
      tables.releaseOccupancy({ group_id: g.id, reason: "", ctx: CTX } as never),
    ).rejects.toThrow("A reason is required to release occupancy");
    await expect(
      tables.forceReleaseOccupancy({ group_id: g.id, reason: "", ctx: CTX } as never),
    ).rejects.toThrow("A reason is required for force release");
    await tables.releaseOccupancy({ group_id: g.id, reason: "meal done", ctx: CTX } as never);
    expect((await tables.getTableById(t.id))?.status).toBe("cleaning");
    await tables.markCleaned({ table_id: t.id, ctx: CTX } as never);
    expect((await tables.getTableById(t.id))?.status).toBe("available");
  });
});

describe("setTableStatus", () => {
  it("blocks illegal transitions", async () => {
    const t = await makeTable();
    await tables.setTableStatus({
      table_id: t.id,
      to: "out_of_service",
      reason: "wobbly leg",
      ctx: CTX,
    } as never);
    expect((await tables.getTableById(t.id))?.status).toBe("out_of_service");
    await expect(tables.seatOccupancy({ table_id: t.id, seats: 2, ctx: CTX })).rejects.toThrow(
      "Table is out of service",
    );
  });
});
