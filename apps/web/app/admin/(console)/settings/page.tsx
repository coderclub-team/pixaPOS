export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-600">
          Console configuration. Secrets live in the hosting provider, never here.
        </p>
      </div>
      <div className="rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Website → Admin wiring</h2>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100">{`POST https://admin.pixapos.store/api/admin/leads
Content-Type: application/json

{
  "businessName": "Yummy Roast",
  "contactName": "Arul",
  "email": "owner@yummyroast.in",
  "phone": "+919876543210",
  "city": "Erode",
  "outletsPlanned": 2,
  "source": "website"
}`}</pre>
      </div>
      <div className="rounded-xl border bg-white p-5 text-sm">
        <h2 className="font-semibold">Environment</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
          <li>
            <code>DATABASE_URL</code> — shared Neon Postgres (same as web app).
          </li>
          <li>
            <code>ADMIN_API_KEY</code> (recommended) — gate PATCH/approve routes.
          </li>
          <li>
            Cookie domain <code>.pixapos.store</code> for shared sessions.
          </li>
        </ul>
      </div>
    </div>
  );
}
