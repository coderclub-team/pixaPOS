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
      <div className="flex flex-col gap-3">
        <Link
          href="/api/docs"
          target="_blank"
          rel="noopener"
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Scalar reference — /api/docs
        </Link>
        <p className="text-xs text-muted-foreground">
          Opens standalone (outside the dashboard layout) so sidebar guards and HMR cannot
          interfere. If it errors, its stack will be visible directly — paste it here.
        </p>
      </div>
    </div>
  );
}
