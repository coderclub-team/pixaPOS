"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { printerSchema, type PrinterValues } from "../schemas/print";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerPrinter, updatePrinter } from "../api/service";
import { printKeys } from "../api/queries";
import type { Printer } from "../api/types";
import { toast } from "sonner";

const CONNECTION_OPTIONS = [
  { value: "NETWORK", label: "Network (TCP 9100 — real printer or emulator)" },
  { value: "USB", label: "USB (native shell)" },
  { value: "BLUETOOTH", label: "Bluetooth (native shell)" },
];

const PAPER_OPTIONS = [
  { value: "P58", label: "58mm — 48 chars, small receipts/tickets" },
  { value: "P78", label: "78mm — 72 chars, standard receipts" },
  { value: "P80", label: "80mm — 80 chars, large receipts/invoices" },
];

export default function PrinterForm({
  initialData,
  editing,
  onDone,
}: {
  initialData: PrinterValues;
  editing?: Printer | null;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: PrinterValues) => {
      const port = values.port?.trim() ? Number.parseInt(values.port, 10) : undefined;
      const cols = values.chars_per_line?.trim()
        ? Number.parseInt(values.chars_per_line, 10)
        : undefined;
      const payload = {
        ...values,
        port: port != null && Number.isFinite(port) ? port : undefined,
        chars_per_line: cols != null && Number.isFinite(cols) && cols > 0 ? cols : undefined,
      };
      return editing ? updatePrinter(editing.id, payload) : registerPrinter(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: printKeys.all });
      toast.success(editing ? "Printer updated" : "Printer added");
      onDone?.();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save printer"),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: printerSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">
          {editing ? `Edit ${editing.name}` : "Add printer"}
        </CardTitle>
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
              name="name"
              children={(field) => (
                <field.TextField
                  label="Printer name"
                  placeholder="Counter bill printer"
                  description="Friendly name — operators pick this when printing"
                />
              )}
            />
            <form.AppField
              name="connection"
              children={(field) => (
                <field.SelectField label="Connection" options={CONNECTION_OPTIONS} />
              )}
            />
            <form.AppField
              name="address"
              children={(field) => (
                <field.TextField
                  label="Address"
                  placeholder="192.168.1.50 (network) or USB device label"
                />
              )}
            />
            <form.AppField
              name="port"
              children={(field) => (
                <field.TextField
                  label="TCP port"
                  placeholder="9100"
                  description="Network printers only"
                />
              )}
            />
            <form.AppField
              name="paper"
              children={(field) => <field.SelectField label="Paper size" options={PAPER_OPTIONS} />}
            />
            <form.AppField
              name="chars_per_line"
              children={(field) => (
                <field.TextField
                  label="Chars per line (optional)"
                  placeholder="Blank = paper default"
                  description="E.g. 42 for Epson Font A on 58mm"
                />
              )}
            />
            <form.AppField
              name="is_default"
              children={(field) => (
                <field.SwitchField
                  label="Default printer"
                  description="Used when no purpose route matches"
                />
              )}
            />
            <form.AppField
              name="is_active"
              children={(field) => (
                <field.SwitchField label="Active" description="Only active printers receive jobs" />
              )}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <form.AppForm
              children={<form.SubmitButton>{editing ? "Save" : "Add printer"}</form.SubmitButton>}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
