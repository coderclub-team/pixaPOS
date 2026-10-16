import { describe, expect, it } from "vitest";
import { toNotification } from "../notify";
import { posSourceEnabled, loadPrefs } from "../prefs";

describe("toNotification", () => {
  it("QR ORDER_CREATED → POS toast, not KDS", () => {
    const ev = {
      event_type: "ORDER_CREATED",
      source_type: "QR",
      metadata: { order_number: "ORD-0001", table_number: "12" },
    };
    const pos = toNotification(ev, "POS");
    expect(pos?.title).toContain("QR");
    expect(pos?.sound).toBe("order");
    expect(toNotification(ev, "KDS")).toBeNull();
  });

  it("KOT event → KDS only", () => {
    const ev = {
      event_type: "ORDER_SENT_TO_KITCHEN",
      source_type: "POS",
      metadata: { kot_number: 2, lines: 4, table_number: "5" },
    };
    const kds = toNotification(ev, "KDS");
    expect(kds?.title).toContain("KOT");
    expect(kds?.body).toContain("4 items");
    expect(toNotification(ev, "POS")).toBeNull();
  });

  it("ORDER_READY → POS/CAPTAIN, not KDS", () => {
    const ev = {
      event_type: "ORDER_READY",
      source_type: "KDS",
      metadata: { order_number: "ORD-9" },
    };
    expect(toNotification(ev, "POS")?.sound).toBe("ready");
    expect(toNotification(ev, "CAPTAIN")?.title).toContain("ready");
    expect(toNotification(ev, "KDS")).toBeNull();
  });

  it("noisy ticket transitions stay silent", () => {
    expect(
      toNotification({ event_type: "KITCHEN_TICKET_UPDATED", source_type: "KDS" }, "KDS"),
    ).toBeNull();
    expect(toNotification({ event_type: "ORDER_SERVED", source_type: "KDS" }, "POS")).toBeNull();
  });
});

describe("prefs gating", () => {
  it("POS own orders never notify", () => {
    expect(posSourceEnabled(loadPrefs(), "POS")).toBe(false);
  });
  it("defaults enable QR/kiosk/online/captain", () => {
    const p = loadPrefs();
    expect(posSourceEnabled(p, "QR")).toBe(true);
    expect(posSourceEnabled(p, "KIOSK")).toBe(true);
    expect(posSourceEnabled(p, "WEBSITE")).toBe(true);
    expect(posSourceEnabled(p, "CAPTAIN")).toBe(true);
  });
});
