import { describe, it, expect } from "vitest";
import { openApiSpec } from "@/lib/openapi/spec";

describe("openapi spec — guardrail", () => {
  it("exposes an OpenAPI 3.1 document with security", () => {
    expect(openApiSpec.openapi).toMatch(/^3\./);
    expect(openApiSpec.info.title).toBe("pixaPOS API");
    expect(openApiSpec.components.securitySchemes.cookieAuth).toBeDefined();
  });

  it("documents the auth + active-org bootstrap (the fix's proving ground)", () => {
    const paths = Object.keys(openApiSpec.paths);
    expect(paths).toContain("/api/me");
    expect(paths).toContain("/api/auth/organization/list");
    expect(paths).toContain("/api/auth/organization/set-active");
    expect(paths).toContain("/api/onboarding");
  });

  it("documents Phase-1 business surface (masters, orders, kots, payments, tables)", () => {
    const paths = Object.keys(openApiSpec.paths);
    const must = [
      "/api/masters/{type}",
      "/api/masters/{type}/{id}",
      "/api/outlets",
      "/api/orders",
      "/api/orders/{id}",
      "/api/orders/{id}/fire",
      "/api/orders/{id}/pay",
      "/api/kots",
      "/api/kots/{id}",
      "/api/payments",
      "/api/floors",
      "/api/tables",
      "/api/reports/item-sales",
    ];
    for (const p of must) expect(paths, `missing ${p}`).toContain(p);
  });

  it("describes the activeOrganizationId prerequisite", () => {
    expect(openApiSpec.info.description).toMatch(/set-active/i);
    expect(openApiSpec.paths["/api/auth/organization/set-active"].post.description).toMatch(
      /activeOrganizationId/i,
    );
  });
});
