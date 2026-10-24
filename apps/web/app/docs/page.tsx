export const dynamic = "force-dynamic";
export default function DocsPage() {
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>API Docs — standalone</h1>
      <p style={{ marginTop: 8 }}>
        This page is outside the dashboard layout (no guards). If this loads but /dashboard/api-docs bounces, the dashboard layout/guard is the culprit.
      </p>
      <p style={{ marginTop: 12 }}>
        <a href="/api/docs" style={{ color: "blue", textDecoration: "underline" }}>Open /api/docs (Scalar)</a> —{" "}
        <a href="/api/openapi.json" style={{ color: "blue", textDecoration: "underline" }}>/api/openapi.json</a>
      </p>
      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>Build: migrate/neon-full-stack 4a0c8e1 — if you see this, routing works.</p>
    </div>
  );
}
