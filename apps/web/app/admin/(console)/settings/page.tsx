import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Console configuration. Secrets live in the hosting provider, never here.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Website → Admin wiring</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100">{`POST https://admin.pixapos.store/api/admin/leads
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <code>DATABASE_URL</code> — shared Neon Postgres (same as web app).
            </li>
            <li>
              <code>SAAS_SETUP_TOKEN</code> — one-time super-owner bootstrap. The seed endpoint 403s
              forever after first use.
            </li>
            <li>
              Owner sessions use their own <code>pixa_owner</code> cookie — never shared with
              restaurant sessions.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
