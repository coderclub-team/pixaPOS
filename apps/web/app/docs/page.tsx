import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DocsPage() {
  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>API Docs</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
        Interactive reference at <a href="/api/docs" style={{ color: "blue", textDecoration: "underline" }}>/api/docs</a> (Scalar) and raw spec at{" "}
        <a href="/api/openapi.json" style={{ color: "blue", textDecoration: "underline" }}>/api/openapi.json</a>. Every business API
        requires <code>POST /api/auth/organization/set-active</code> first — or <code>POST /api/onboarding</code> on a fresh DB. Scalar sends your
        Better Auth cookie automatically same-origin, so sign in first, then &quot;Try it&quot;.
      </p>
      <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 500 }}>Quick test in Scalar:</p>
        <ol style={{ marginTop: 8, paddingLeft: 20, fontSize: 14, lineHeight: "1.6" }}>
          <li>
            <code>GET /api/me</code> — should show <code>active_organization_id</code>
          </li>
          <li>
            If <code>null</code>, run <code>POST /api/auth/organization/set-active {"{ organizationId }"}</code>
          </li>
          <li>
            Then <code>GET /api/masters/categories</code> — should return catalog, not <code>no active organization</code>
          </li>
        </ol>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link
          href="/api/docs"
          style={{
            display: "inline-block",
            background: "#111827",
            color: "white",
            padding: "8px 16px",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Open Scalar — /api/docs
        </Link>
      </p>
      <p style={{ marginTop: 12, fontSize: 12, color: "#999" }}>
        This page lives outside the dashboard layout so phone/first-run guards cannot bounce it. Sidebar &quot;API Docs&quot; now points here.
      </p>
    </div>
  );
}
