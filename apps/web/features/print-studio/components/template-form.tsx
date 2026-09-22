"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { linesToText, templateSchema, textToLines, type TemplateValues } from "../schemas/print";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveTemplate } from "../api/service";
import { printKeys } from "../api/queries";
import type { PrintPurpose, PrintTemplate } from "../api/types";
import { toast } from "sonner";

const QR_OPTIONS = [
  { value: "UPI", label: "UPI collect QR (bill)" },
  { value: "ORDER", label: "Order tracking QR" },
  { value: "EINVOICE", label: "e-Invoice QR" },
  { value: "NONE", label: "No QR" },
];

export default function TemplateForm({
  purpose,
  initialData,
}: {
  purpose: PrintPurpose;
  initialData: TemplateValues;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: TemplateValues) =>
      saveTemplate(purpose, {
        ...values,
        header_lines: textToLines(values.header_lines),
        footer_lines: textToLines(values.footer_lines),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: printKeys.all });
      toast.success(`${purpose} template saved`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save template"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: templateSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">{purpose} template</CardTitle>
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
            <form.AppField
              name="auto_print"
              children={(field) => (
                <field.SwitchField
                  label="Auto-print"
                  description={
                    purpose === "KOT"
                      ? "Print automatically when a KOT fires"
                      : purpose === "BILL"
                        ? "Print automatically when an order completes"
                        : "Print automatically for takeaway orders"
                  }
                />
              )}
            />
            <form.AppField
              name="header_lines"
              children={(field) => (
                <field.TextareaField
                  label="Header lines"
                  placeholder={"Outlet name\nSlogan line"}
                  description="One per line, centered at the top"
                />
              )}
            />
            <form.AppField
              name="show_outlet_address"
              children={(field) => <field.SwitchField label="Outlet address + phone" />}
            />
            <form.AppField
              name="show_gstin"
              children={(field) => <field.SwitchField label="GSTIN" />}
            />
            <form.AppField
              name="show_fssai"
              children={(field) => <field.SwitchField label="FSSAI number" />}
            />
            <form.AppField
              name="show_tax_breakup"
              children={(field) => <field.SwitchField label="Tax breakup" />}
            />
            {purpose === "BILL" && (
              <form.AppField
                name="show_payments"
                children={(field) => (
                  <field.SwitchField label="Payment lines (method, tendered, change)" />
                )}
              />
            )}
            <form.AppField
              name="qr"
              children={(field) => <field.SelectField label="QR code" options={QR_OPTIONS} />}
            />
            <form.AppField
              name="footer_lines"
              children={(field) => (
                <field.TextareaField
                  label="Footer lines"
                  placeholder={"Thank you! Visit again"}
                  description="One per line, centered at the bottom"
                />
              )}
            />
            <form.AppField
              name="show_powered_by"
              children={(field) => <field.SwitchField label="Powered-by line" />}
            />
            <form.AppField
              name="copies"
              children={(field) => (
                <field.SliderField label="Copies" min={1} max={5} description="Copies per print" />
              )}
            />
            {purpose === "BILL" && (
              <form.AppField
                name="merchant_copy"
                children={(field) => (
                  <field.SwitchField
                    label="Merchant copy"
                    description="Extra copy for the counter (fresh bills only)"
                  />
                )}
              />
            )}
            <form.AppField
              name="cut_after"
              children={(field) => <field.SwitchField label="Cut after print" />}
            />
            <form.AppField
              name="beep"
              children={(field) => <field.SwitchField label="Beep after print" />}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm children={<form.SubmitButton>Save template</form.SubmitButton>} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function templateToValues(t: PrintTemplate): TemplateValues {
  return {
    show_logo: t.show_logo,
    header_lines: linesToText(t.header_lines),
    show_outlet_address: t.show_outlet_address,
    show_gstin: t.show_gstin,
    show_fssai: t.show_fssai,
    show_tax_breakup: t.show_tax_breakup,
    show_payments: t.show_payments,
    qr: t.qr,
    footer_lines: linesToText(t.footer_lines),
    show_powered_by: t.show_powered_by,
    copies: t.copies,
    merchant_copy: t.merchant_copy,
    cut_after: t.cut_after,
    beep: t.beep,
    auto_print: t.auto_print,
  };
}
