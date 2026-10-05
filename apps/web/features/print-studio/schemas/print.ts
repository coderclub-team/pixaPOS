import * as z from "zod";

export const printerSchema = z.object({
  name: z.string().min(2, "Printer name must be at least 2 characters"),
  connection: z.enum(["NETWORK", "USB", "BLUETOOTH"]),
  address: z.string().min(1, "Address/host required (e.g. 192.168.1.50 or USB device label)"),
  /** TCP port as typed (TextField) — parsed to number on submit. */
  port: z.string().optional(),
  paper: z.enum(["P58", "P78", "P80"]),
  /** Blank = paper default (48/72/80). Epson Font A on 58mm needs 42. */
  chars_per_line: z.string().optional(),
  supports_raster: z.boolean(),
  qr_mode_byte: z.enum(["auto", "on", "off"]),
  is_default: z.boolean(),
  is_active: z.boolean(),
});

export type PrinterValues = z.infer<typeof printerSchema>;

export const templateSchema = z.object({
  show_logo: z.boolean(),
  paper: z.enum(["PRINTER", "P58", "P78", "P80"]),
  tracking_base_url: z.string().optional().or(z.literal("")),
  header_lines: z.string(),
  show_outlet_address: z.boolean(),
  show_gstin: z.boolean(),
  show_fssai: z.boolean(),
  show_tax_breakup: z.boolean(),
  show_payments: z.boolean(),
  qr: z.enum(["UPI", "ORDER", "EINVOICE", "NONE"]),
  footer_lines: z.string(),
  show_powered_by: z.boolean(),
  copies: z.number().int().min(1).max(5),
  merchant_copy: z.boolean(),
  cut_after: z.boolean(),
  beep: z.boolean(),
  auto_print: z.boolean(),
});

export type TemplateValues = z.infer<typeof templateSchema>;

/** textarea (one line per row) <-> string[] helpers for header/footer. */
export function linesToText(lines: string[]): string {
  return lines.join("\n");
}

export function textToLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
