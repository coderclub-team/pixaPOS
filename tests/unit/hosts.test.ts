import { describe, expect, it } from "vitest";
import { isSurfaceHost, resolveSurfaceRoute } from "@/lib/hosts";

describe("resolveSurfaceRoute", () => {
  it("maps known subdomains to surfaces", () => {
    expect(resolveSurfaceRoute("pos.pixapos.store")).toBe("/pos");
    expect(resolveSurfaceRoute("kds.pixapos.store")).toBe("/kds");
    expect(resolveSurfaceRoute("app.pixapos.store")).toBe("/dashboard");
    expect(resolveSurfaceRoute("captain.pixapos.store")).toBe("/pos");
    expect(resolveSurfaceRoute("order.pixapos.store")).toBe("/order");
    expect(resolveSurfaceRoute("qr.pixapos.store")).toBe("/qr");
  });

  it("is case-insensitive and ignores ports", () => {
    expect(resolveSurfaceRoute("POS.pixapos.store:3000")).toBe("/pos");
  });

  it("passes through local, preview, and unknown hosts", () => {
    expect(resolveSurfaceRoute("localhost:3000")).toBeNull();
    expect(resolveSurfaceRoute("127.0.0.1:3000")).toBeNull();
    expect(resolveSurfaceRoute("my-app.vercel.app")).toBeNull();
    expect(resolveSurfaceRoute("evil.example.com")).toBeNull();
    expect(resolveSurfaceRoute(null)).toBeNull();
  });

  it("resolves the apex domain to marketing", () => {
    expect(resolveSurfaceRoute("pixapos.store")).toBe("/");
  });
});

describe("isSurfaceHost", () => {
  it("detects participating hosts", () => {
    expect(isSurfaceHost("kds.pixapos.store")).toBe(true);
    expect(isSurfaceHost("localhost")).toBe(false);
    expect(isSurfaceHost(null)).toBe(false);
  });
});
