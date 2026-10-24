import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">
          Interactive API reference is served at{" "}
          <Link href="/api/docs" className="underline">
            /api/docs
          </Link>{" "}
          (Scalar) and the raw OpenAPI JSON at{" "}
          <Link href="/api/openapi.json" className="underline">
            /api/openapi.json
          </Link>
          . Every business API requires an active organization —{" "}
          <code className="rounded bg-muted px-1">POST /api/auth/organization/set-active</code>{" "}
          first (or complete <code className="rounded bg-muted px-1">POST /api/onboarding</code> on
          a fresh database). Scalar sends your Better Auth session cookie automatically same-origin,
          so sign in on this host first, then &quot;Try it&quot; in the reference.
        </p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Quick test in Scalar:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>
            <code>GET /api/me</code> — should show your <code>active_organization_id</code>
          </li>
          <li>
            If it is <code>null</code>, run{" "}
            <code>POST /api/auth/organization/set-active {"{ organizationId }"}</code>
          </li>
          <li>
            Then <code>GET /api/masters/categories</code> — should return your catalog, not{" "}
            <code>no active organization</code>
          </li>
        </ol>
      </div>
      <div className="overflow-hidden rounded-lg border" style={{ height: "80vh" }}>
        <iframe title="Scalar API Reference" src="/api/docs" className="h-full w-full border-0" />
      </div>
    </div>
  );
}
