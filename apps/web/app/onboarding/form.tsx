"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useIdentity } from "@/hooks/use-identity";
import { baOrgs } from "@/lib/auth-client";
import { useAppForm } from "@/lib/form";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";

const SOURCES = [
  "YouTube",
  "Instagram",
  "Website / Google search",
  "Referral",
  "Field sales",
  "Other",
];

const OUTLET_COUNTS = ["1", "2–5", "6–20", "20+"];

/**
 * Post-signup workspace setup (the funnel fork): zero-org users land here,
 * fill the business + outlet profile, and get org + trial row + POS seeds in
 * one submit. Users who already own an org are bounced to /dashboard.
 */
export default function OnboardingForm() {
  const router = useRouter();
  const { user, organizations, orgsLoaded } = useIdentity();
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (orgsLoaded && user && organizations.length > 0) router.replace("/dashboard");
  }, [orgsLoaded, user, organizations, router]);

  const form = useAppForm({
    defaultValues: {
      business_name: "",
      currency: "INR",
      country: "IN",
      timezone: "Asia/Kolkata",
      outlet_name: "",
      outlet_address: "",
      outlets_count: "1",
      source: "",
      monthly_orders: "",
      lat: "",
      lng: "",
    } as Record<string, string>,
    onSubmit: async ({ value }) => {
      if (!value.business_name.trim()) {
        toast.error("Business name is required");
        return;
      }
      if (!value.outlet_name.trim()) {
        toast.error("Initial outlet name is required");
        return;
      }
      const plan = (() => {
        try {
          const m = document.cookie.match(/(?:^|; )pixa_funnel=([^;]*)/);
          const funnel = m ? JSON.parse(decodeURIComponent(m[1])) : {};
          const p = String(funnel.plan ?? "").trim();
          return ["starter", "growth", "scale", "trial"].includes(p) ? p : "starter";
        } catch {
          return "starter";
        }
      })();
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...value, plan }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        organizationId?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.organizationId) {
        toast.error(data?.error ?? "Couldn't create workspace");
        return;
      }
      try {
        await baOrgs.setActive(data.organizationId);
      } catch {}
      toast.success("Workspace ready — trial started");
      router.replace("/dashboard");
      router.refresh();
    },
  });

  const useLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported — type the address instead");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        form.setFieldValue("lat", pos.coords.latitude.toFixed(6));
        form.setFieldValue("lng", pos.coords.longitude.toFixed(6));
        toast.success("Location captured (optional)");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't read location — type the address instead");
      },
      { timeout: 10000 },
    );
  };

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center p-6 md:p-10">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Set up your business</CardTitle>
          <CardDescription>
            14-day free trial · No credit card — workspace, outlet and trial in one step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="grid gap-4"
          >
            <FieldGroup>
              <form.AppField
                name="business_name"
                children={(field) => (
                  <field.TextField
                    label="Business / restaurant name"
                    required
                    placeholder="e.g. Annapoorani Bhavan"
                  />
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <form.AppField
                  name="currency"
                  children={(field) => (
                    <field.TextField label="Currency" required placeholder="INR" />
                  )}
                />
                <form.AppField
                  name="country"
                  children={(field) => (
                    <field.TextField label="Country" required placeholder="IN" />
                  )}
                />
                <form.AppField
                  name="timezone"
                  children={(field) => (
                    <field.TextField label="Timezone" required placeholder="Asia/Kolkata" />
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.AppField
                  name="outlet_name"
                  children={(field) => (
                    <field.TextField
                      label="Initial outlet name"
                      required
                      placeholder="Main counter"
                    />
                  )}
                />
                <form.AppField
                  name="outlets_count"
                  children={(field) => (
                    <field.SelectField
                      label="Number of outlets"
                      required
                      options={OUTLET_COUNTS.map((o) => ({ value: o, label: o }))}
                    />
                  )}
                />
              </div>
              <form.AppField
                name="outlet_address"
                children={(field) => (
                  <field.TextField
                    label="Outlet address"
                    placeholder="Shop no, street, area, city, PIN"
                  />
                )}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={useLocation}
                  disabled={locating}
                >
                  {locating
                    ? "Reading location…"
                    : form.state.values.lat
                      ? `📍 ${form.state.values.lat}, ${form.state.values.lng}`
                      : "Use my location (optional)"}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.AppField
                  name="source"
                  children={(field) => (
                    <field.SelectField
                      label="Where did you hear about us?"
                      options={SOURCES.map((s) => ({ value: s, label: s }))}
                      placeholder="Select one"
                    />
                  )}
                />
                <form.AppField
                  name="monthly_orders"
                  children={(field) => (
                    <field.TextField
                      label="Monthly orders (optional)"
                      placeholder="e.g. 3000"
                      inputMode="numeric"
                    />
                  )}
                />
              </div>
            </FieldGroup>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating workspace…" : "Create workspace & start trial"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
