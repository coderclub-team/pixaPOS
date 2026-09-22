/** Print Studio domain types (Phase 1: bill + KOT + token + reprints). */

export type PaperSize = "P58" | "P78" | "P80";

/** Paper profiles: printable chars per line + head dots (203dpi class). */
export const PAPER_PROFILES: Record<
  PaperSize,
  { label: string; chars: number; dots: number; use: string }
> = {
  P58: { label: "58mm", chars: 48, dots: 384, use: "Small receipts, tickets" },
  P78: { label: "78mm", chars: 72, dots: 576, use: "Standard receipts" },
  P80: { label: "80mm", chars: 80, dots: 640, use: "Large receipts, invoices" },
};

export type PrinterConnection = "NETWORK" | "USB" | "BLUETOOTH";

export type Printer = {
  id: string;
  outlet_id: string;
  name: string;
  connection: PrinterConnection;
  /** NETWORK: host. USB/BT: device id or label (resolved at print time). */
  address: string;
  /** NETWORK: raw ESC/POS TCP port (real printers + emulator default 9100). */
  port?: number;
  paper: PaperSize;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PrinterPayload = Partial<
  Omit<Printer, "id" | "outlet_id" | "created_at" | "updated_at">
> & {
  name: string;
  connection: PrinterConnection;
  address: string;
  paper: PaperSize;
};

export type PrintPurpose = "BILL" | "KOT" | "TOKEN" | "REPORT";

export type PrintRoute = {
  id: string;
  outlet_id: string;
  purpose: PrintPurpose;
  printer_id: string;
  /** BTill-style filters: empty = all. v1 seeds one default route per purpose. */
  channels?: string[];
  order_types?: string[];
  is_active: boolean;
};

export type QRKind = "UPI" | "ORDER" | "EINVOICE" | "NONE";

export type PrintTemplate = {
  id: string;
  outlet_id: string;
  purpose: PrintPurpose;
  show_logo: boolean;
  header_lines: string[];
  show_outlet_address: boolean;
  show_gstin: boolean;
  show_fssai: boolean;
  show_tax_breakup: boolean;
  show_payments: boolean;
  qr: QRKind;
  footer_lines: string[];
  show_powered_by: boolean;
  copies: number;
  /** Customer + merchant copy (bill only). */
  merchant_copy: boolean;
  cut_after: boolean;
  beep: boolean;
  /** Auto-print on trigger (KOT: on fire, BILL: on complete, TOKEN: on takeaway fire). */
  auto_print: boolean;
  updated_at: string;
};

export type PrintJobStatus = "QUEUED" | "SENT" | "FAILED";

export type PrintJob = {
  id: string;
  outlet_id: string;
  purpose: PrintPurpose;
  /** Order or KOT id the doc was built from. */
  ref_id: string;
  printer_id: string;
  /** Immutable snapshot id (doc hash) — reprints build new jobs, never mutate. */
  doc_hash: string;
  is_reprint: boolean;
  reprint_reason?: string;
  status: PrintJobStatus;
  attempts: number;
  last_error?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

/** eBill payload: same Bill doc serialized for SMS/WhatsApp providers (Phase 2). */
export type EBillChannel = "SMS" | "WHATSAPP";

export type EBillPayload = {
  order_id: string;
  order_number: string;
  outlet_name: string;
  grand_total_paise: number;
  upi_intent?: string;
  tracking_url?: string;
  channel: EBillChannel;
  recipient_phone: string;
};

export type PrintFilters = {
  purpose?: PrintPurpose;
  status?: PrintJobStatus;
  outlet_id?: string;
};
