"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import PageContainer from "@pixa/ui/layout/page-container";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@pixa/forms";
import { outletKeys, outletsQueryOptions } from "@/features/outlet/api/queries";
import { getQueryClient } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";
import * as z from "zod";

const newOutletSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  code: z.string().trim().max(12).optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
});

type NewOutletValues = z.infer<typeof newOutletSchema>;

/**
 * Code candidates derived from the outlet name (mirrors the server's
 * slugCode plus common variants). Returns up to 4 unique options.
 */
export function suggestOutletCodes(name: string): string[] {
  const words = name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const compact = words.join("").slice(0, 12);
  const candidates = [
    compact.slice(0, 6),
    words
      .map((w) => w[0])
      .join("")
      .slice(0, 6),
    words.length > 1 ? (words[0].slice(0, 3) + words[1].slice(0, 3)).slice(0, 12) : "",
    compact.slice(0, 4),
  ];
  const seen = new Set<string>();
  return candidates
    .map((c) => c.trim())
    .filter((c) => c.length >= 2 && !seen.has(c) && (seen.add(c), true));
}

/**
 * Minimal outlet creation: identity only. After POST, phone/city are saved
 * via PUT and the user lands on the new outlet's detail page to complete
 * address, legal, payments, team, and stations.
 */
export default function NewOutletPage() {
  const router = useRouter();

  const createMutation = useMutation({
    mutationFn: async (values: NewOutletValues) => {
      const res = await fetch("/api/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          code: (values.code ?? "").trim() || undefined,
        }),
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; id?: string; code?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create outlet");
      if (!data.id) throw new Error("Failed to create outlet");
      const phone = (values.phone ?? "").trim();
      const city = (values.city ?? "").trim();
      if (phone || city) {
        const put = await fetch(`/api/outlets/${encodeURIComponent(data.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(phone ? { phone } : {}),
            ...(city ? { city } : {}),
          }),
          credentials: "include",
        });
        if (!put.ok) {
          const err = (await put.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? "Outlet created, but phone/city did not save");
        }
      }
      return data;
    },
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({ queryKey: outletKeys.list() });
      toast.success(`Outlet ${data.code} created with kitchen stations`);
      router.push(`/dashboard/settings/outlets/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = useAppForm({
    defaultValues: { name: "", code: "", phone: "", city: "" } as NewOutletValues,
    validators: { onSubmit: newOutletSchema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  return (
    <PageContainer
      pageTitle="New Outlet"
      pageDescription="Create the outlet identity. You'll complete address, legal, payments, and team on its detail page."
    >
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-left text-xl font-bold">Outlet Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="name"
                  children={(field) => (
                    <field.TextField label="Outlet Name *" required placeholder="Bandra West" />
                  )}
                />
                <form.AppField
                  name="code"
                  children={(field) => (
                    <div className="space-y-2">
                      <field.TextField
                        label="Code"
                        placeholder="Auto from name"
                        description="Short code, e.g. BANDRA"
                      />
                      <CodeSuggestions
                        name={String(field.form.state.values.name ?? "")}
                        current={String(field.state.value ?? "")}
                        onPick={(c) => field.setValue(c)}
                      />
                    </div>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <form.AppField
                  name="phone"
                  children={(field) => (
                    <field.TextField label="Phone" type="tel" placeholder="9876543210" />
                  )}
                />
                <form.AppField
                  name="city"
                  children={(field) => <field.TextField label="City" placeholder="Mumbai" />}
                />
              </div>
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <form.AppForm children={<form.SubmitButton>Create Outlet</form.SubmitButton>} />
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function CodeSuggestions({
  name,
  current,
  onPick,
}: {
  name: string;
  current: string;
  onPick: (code: string) => void;
}) {
  const { data: outlets } = useQuery(outletsQueryOptions);
  const taken = new Set((outlets ?? []).map((o) => o.code.trim().toUpperCase()));
  const suggestions = suggestOutletCodes(name).filter((c) => c !== current.trim().toUpperCase());
  if (name.trim().length < 2 || suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Suggestions:</span>
      {suggestions.map((c) => {
        const isTaken = taken.has(c);
        return (
          <button
            key={c}
            type="button"
            disabled={isTaken}
            onClick={() => onPick(c)}
            title={isTaken ? `${c} is already taken` : `Use ${c}`}
            className="rounded-md border px-2 py-0.5 font-mono text-xs font-medium transition-colors hover:border-primary/50 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through"
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
