import { describe, expect, it } from "vitest";
import { countryName, currencyOptions, indiaLockError, timeZoneOptions } from "@/lib/geo";

describe("indiaLockError", () => {
  it("accepts the India triple", () => {
    expect(indiaLockError("IN", "INR", "Asia/Kolkata")).toBeNull();
  });

  it("rejects any non-India selection", () => {
    expect(indiaLockError("US", "INR", "Asia/Kolkata")).toMatch(/only onboard Indian/i);
    expect(indiaLockError("IN", "USD", "Asia/Kolkata")).toMatch(/only onboard Indian/i);
    expect(indiaLockError("IN", "INR", "America/New_York")).toMatch(/only onboard Indian/i);
  });
});

describe("geo option helpers", () => {
  it("always includes the India timezone first", () => {
    const zones = timeZoneOptions();
    expect(zones.length).toBeGreaterThan(0);
    expect(zones[0].value).toBe("Asia/Kolkata");
  });

  it("exposes currency options including INR", () => {
    const values = currencyOptions().map((c) => c.value);
    expect(values).toContain("INR");
  });

  it("countryName falls back to the code", () => {
    expect(countryName("IN")).toBe("India");
    expect(countryName("XX", "en")).toBe("XX");
  });
});
