"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import TemplateForm, { templateToValues } from "@/features/print-studio/components/template-form";
import ReceiptPreview from "@/features/print-studio/components/receipt-preview";
import { templateQueryOptions } from "@/features/print-studio/api/queries";
import { outletQueryOptions } from "@/features/outlet/api/queries";
import { buildBillDoc, buildKOTDoc, buildTokenDoc } from "@/features/print-studio/api/docs";
import type { PrintPurpose } from "@/features/print-studio/api/types";
import { Button } from "@pixa/ui/base-ui/button";

const PURPOSES: PrintPurpose[] = ["BILL", "KOT", "TOKEN"];

const SAMPLE_DATE = new Date().toISOString();

/** Canned sample so every template has a live preview without touching orders. */
function useSampleDoc(purpose: PrintPurpose, outletId: string) {
  const { data: template } = useQuery(templateQueryOptions(purpose));
  const { data: outlet } = useQuery(outletQueryOptions);
  return useMemo(() => {
    if (!template || !outlet) return null;
    if (purpose === "BILL") {
      return buildBillDoc({
        billing: {
          order: {
            id: "sample",
            outlet_id: outletId,
            order_number: "A-1024",
            channel: "dine_in",
            table_number_snapshot: "T-07",
            customer_name: "Sample Guest",
            status: "COMPLETED",
            items: [
              {
                id: "li_1",
                menu_item_id: "m_1",
                item_name_snapshot: "Paneer Butter Masala",
                variant_name_snapshot: "Full",
                unit_price_paise: 26000,
                tax_percent_snapshot: 5,
                modifiers: [
                  { modifier_id: "mo_1", name_snapshot: "Extra Cheese", price_paise: 4000 },
                ],
                qty: 2,
                line_total_paise: 52000,
                line_tax_paise: 2600,
                instructions: "Less spicy",
              },
            ],
            subtotal_paise: 52000,
            tax_paise: 2600,
            total_paise: 54600,
            grand_total_paise: 54600,
            payment_status: "PAID",
            created_at: SAMPLE_DATE,
            updated_at: SAMPLE_DATE,
            version: 1,
          },
          paid_paise: 54600,
          balance_paise: 0,
        },
        payments: [],
        outlet,
        template,
        upiId: "sample@upi",
      });
    }
    if (purpose === "KOT") {
      return buildKOTDoc({
        ticket: {
          id: "sample",
          outlet_id: outletId,
          order_id: "sample",
          order_number_snapshot: "A-1024",
          table_number_snapshot: "T-07",
          channel: "dine_in",
          kot_number: 7,
          status: "NEW",
          lines: [
            {
              id: "kl_1",
              order_line_id: "li_1",
              item_name_snapshot: "Paneer Butter Masala",
              variant_name_snapshot: "Full",
              modifiers_snapshot: ["Extra Cheese"],
              instructions: "Less spicy",
              qty: 2,
              voided_qty: 0,
              returned_qty: 0,
              status: "PENDING",
            },
          ],
          voids: [],
          returns: [],
          fired_by: "captain-1",
          fired_at: SAMPLE_DATE,
          updated_at: SAMPLE_DATE,
          version: 1,
        },
        outlet,
        template,
      });
    }
    return buildTokenDoc({
      orderNumber: "A-1024",
      tokenNo: "T-42",
      outlet,
      template,
      trackingUrl: "https://order.pixapos.store/t/T-42",
      itemCount: 3,
    });
  }, [template, outlet, purpose, outletId]);
}

export default function TemplatesPage() {
  const [purpose, setPurpose] = useState<PrintPurpose>("BILL");
  const { data: template, isPending } = useQuery(templateQueryOptions(purpose));
  const { data: outlet } = useQuery(outletQueryOptions);
  const doc = useSampleDoc(purpose, "out_001");

  return (
    <PageContainer
      pageTitle="Templates"
      pageDescription="Print Studio — bill, KOT and token layouts"
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex gap-1">
          {PURPOSES.map((p) => (
            <Button
              key={p}
              variant={purpose === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPurpose(p)}
            >
              {p}
            </Button>
          ))}
        </div>
        {isPending || !template ? (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            Loading template…
          </div>
        ) : (
          <>
            <TemplateForm
              key={purpose}
              purpose={purpose}
              initialData={templateToValues(template)}
            />
            {doc && (
              <ReceiptPreview
                doc={doc}
                title={`${purpose} preview`}
                logoUrl={
                  template.show_logo && outlet?.logo_url && typeof outlet.logo_url === "string"
                    ? outlet.logo_url
                    : undefined
                }
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
