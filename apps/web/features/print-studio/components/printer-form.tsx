"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { FieldGroup } from "@pixa/ui/base-ui/field";
import { useAppForm } from "@/lib/form";
import { printerSchema, type PrinterValues } from "../schemas/print";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerPrinter, updatePrinter } from "../api/service";
import {
  pairedUsbPrinters,
  requestBlePrinter,
  requestUsbPrinter,
  webBluetoothSupported,
  webUsbSupported,
} from "../api/transport";
import { printKeys } from "../api/queries";
import type { Printer } from "../api/types";
import { Button } from "@pixa/ui/base-ui/button";
import { useState } from "react";
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

  const [scanning, setScanning] = useState<"usb" | "ble" | null>(null);
  const [showIpGuide, setShowIpGuide] = useState(false);

  async function discoverUsb(): Promise<void> {
    setScanning("usb");
    try {
      const found = await requestUsbPrinter();
      form.setFieldValue("connection", "USB");
      form.setFieldValue("address", found.address);
      if (!form.state.values.name) form.setFieldValue("name", found.label);
      toast.success(`Found ${found.label} — save to add`);
    } catch (e) {
      if (e instanceof Error && e.name === "NotFoundError") return;
      toast.error(e instanceof Error ? e.message : "USB scan failed");
    } finally {
      setScanning(null);
    }
  }

  async function discoverBle(): Promise<void> {
    setScanning("ble");
    try {
      const found = await requestBlePrinter();
      form.setFieldValue("connection", "BLUETOOTH");
      form.setFieldValue("address", found.address);
      if (!form.state.values.name) form.setFieldValue("name", found.label);
      toast.success(`Found ${found.label} — save to add`);
    } catch (e) {
      if (e instanceof Error && e.name === "NotFoundError") return;
      toast.error(e instanceof Error ? e.message : "Bluetooth scan failed");
    } finally {
      setScanning(null);
    }
  }

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
            <div className="rounded-xl border p-3">
              <p className="text-sm font-medium">Discover nearby printer</p>
              <p className="text-xs text-muted-foreground">
                USB and BLE open the OS picker — tap your printer to fill the form.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={scanning !== null || !webUsbSupported()}
                  onClick={() => void discoverUsb()}
                  title={
                    webUsbSupported()
                      ? "Scan USB"
                      : "WebUSB needs Chrome/Edge on localhost or HTTPS"
                  }
                >
                  {scanning === "usb" ? "Scanning…" : "Scan USB"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={scanning !== null || !webBluetoothSupported()}
                  onClick={() => void discoverBle()}
                  title={
                    webBluetoothSupported()
                      ? "Scan Bluetooth LE"
                      : "Web Bluetooth needs Chrome/Edge on localhost or HTTPS"
                  }
                >
                  {scanning === "ble" ? "Scanning…" : "Scan Bluetooth"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowIpGuide((v) => !v)}
                >
                  Find WiFi IP
                </Button>
              </div>
              {showIpGuide && (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                  <li>
                    Hold the printer&apos;s Feed button, power on — it prints a self-test page with
                    its IP.
                  </li>
                  <li>Enter that IP in Address below (port stays 9100).</li>
                  <li>Save, then use Test print — a receipt must arrive before going live.</li>
                  <li>Tip: reserve the IP in your router (DHCP reservation) so it never moves.</li>
                </ol>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Classic-Bluetooth (SPP) printers — the majority — are invisible to browsers; pair
                those in OS settings and enter details manually, or use a native shell later.
              </p>
            </div>
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
              name="supports_raster"
              children={(field) => (
                <field.SwitchField
                  label="Raster graphics (GS v 0)"
                  description="Off for emulators — they drop graphics and the receipt vanishes"
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
