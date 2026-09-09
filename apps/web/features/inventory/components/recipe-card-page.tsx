"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { recipeQueryOptions } from "@/features/inventory/api/queries";
import { menuItemsQueryOptions } from "@/features/menu/api/queries";
import PageContainer from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { Icons } from "@pixa/ui/icons";
import Link from "next/link";

export default function RecipeCardPage({ recipeId }: { recipeId: string }) {
  const { data } = useSuspenseQuery(recipeQueryOptions(recipeId));
  const { data: menuItems } = useSuspenseQuery(menuItemsQueryOptions({}));
  if (!data) notFound();
  const r = data;
  const linked = (menuItems ?? []).find((m) => m.id === (r as any).menu_item_id);
  const variantCols = linked && linked.variants.length > 1 ? linked.variants : [];
  const qtyFor = (ing: (typeof r.ingredients)[number], variantId?: string) => {
    if (!variantId) return ing.qty;
    return ing.variant_qtys?.find((vq) => vq.variant_id === variantId)?.qty ?? ing.qty;
  };
  const totalTime = ((r as any).prep_time_min ?? 0) + ((r as any).cook_time_min ?? 0);

  return (
    <PageContainer
      pageTitle={r.name}
      pageDescription={`Recipe card — yields ${r.yields}${(r as any).yield_unit ? ` ${(r as any).yield_unit}` : ""}${totalTime ? ` • ${totalTime} min` : ""}`}
      pageHeaderAction={
        <div className="flex gap-2">
          <Link href={`/dashboard/inventory/recipes/${r.id}/edit`}>
            <Button variant="outline" size="sm">
              <Icons.edit className="mr-1 h-4 w-4" /> Edit
            </Button>
          </Link>
          <Button size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty{variantCols.length === 0 && ` (${r.ingredients[0]?.unit ?? ""})`}</TableHead>
                  {variantCols.map((v) => (
                    <TableHead key={v.id} className="text-right">
                      {v.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Cost/Serve</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.ingredients.map((ing) => (
                  <TableRow key={ing.material_id}>
                    <TableCell>
                      <span className="font-medium">{ing.material_name}</span>
                      {ing.wastage_percent ? (
                        <span className="text-xs text-muted-foreground"> +{ing.wastage_percent}% waste</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ing.qty} {ing.unit}
                    </TableCell>
                    {variantCols.map((v) => (
                      <TableCell key={v.id} className="text-right font-mono text-xs">
                        {qtyFor(ing, v.id)} {ing.unit}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs">—</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {(r.steps ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Method ({r.steps.length} steps)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {r.steps.map((s) => (
                <div key={s.id} className="flex gap-3 rounded-lg border p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
                    {s.step_no}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm">{s.instruction}</p>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {s.vessel && (
                        <span className="rounded border px-1.5 py-0.5">{s.vessel.replace("_", " ")}</span>
                      )}
                      {s.temperature_c !== undefined && (
                        <span className="rounded border px-1.5 py-0.5">{s.temperature_c}°C</span>
                      )}
                      {s.heat_level && (
                        <span className="rounded border px-1.5 py-0.5 capitalize">{s.heat_level} heat</span>
                      )}
                      {s.duration_min !== undefined && (
                        <span className="rounded border px-1.5 py-0.5">{s.duration_min} min</span>
                      )}
                      {s.is_optional && (
                        <span className="rounded border px-1.5 py-0.5">Optional</span>
                      )}
                    </div>
                  </div>
                  {s.image_url && (
                    <img
                      src={s.image_url}
                      alt={`step-${s.step_no}`}
                      className="h-20 w-20 shrink-0 rounded border object-cover"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {((r as any).plating_notes || (r as any).garnish || (r as any).serving_vessel) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Presentation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {(r as any).plating_notes && <p>Plating: {(r as any).plating_notes}</p>}
              {(r as any).garnish && <p>Garnish: {(r as any).garnish}</p>}
              {(r as any).serving_vessel && <p>Serve in: {(r as any).serving_vessel}</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-wrap gap-4 py-4 text-sm">
            <span>
              Batch cost: <span className="font-mono font-medium">₹{r.cost_per_serve}</span>
            </span>
            {(r.cost_per_variant ?? []).map((vc) => (
              <span key={vc.variant_id}>
                {vc.variant_name}: <span className="font-mono font-medium">₹{vc.cost}</span>
              </span>
            ))}
            {r.selling_price ? (
              <span>
                Selling: <span className="font-mono font-medium">₹{r.selling_price}</span>
              </span>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
