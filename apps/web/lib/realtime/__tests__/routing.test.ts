import { describe, it, expect } from "vitest";
import { resolveTargets, shouldDeliverTo } from "../routing";

describe("routing", () => {
  it("routes ORDER_CREATED POS -> KDS", () => {
    expect(resolveTargets("ORDER_CREATED", "POS")).toEqual(["KDS"]);
  });
  it("routes ORDER_CREATED QR -> POS,KDS", () => {
    expect(resolveTargets("ORDER_CREATED", "QR")).toEqual(["POS", "KDS"]);
  });
  it("routes KDS status -> POS,CAPTAIN", () => {
    expect(resolveTargets("KITCHEN_STARTED", "KDS")).toEqual(["POS", "CAPTAIN"]);
  });
  it("target override wins over rule", () => {
    expect(
      shouldDeliverTo({ event_type: "ORDER_CREATED", target: { terminalTypes: ["KDS"] } }, "POS"),
    ).toBe(false);
    expect(
      shouldDeliverTo({ event_type: "ORDER_CREATED", target: { terminalTypes: ["KDS"] } }, "KDS"),
    ).toBe(true);
  });
  it("unknown event delivers to all", () => {
    expect(resolveTargets("UNKNOWN")).toBeUndefined();
    expect(shouldDeliverTo({ event_type: "UNKNOWN" }, "POS")).toBe(true);
  });
});
