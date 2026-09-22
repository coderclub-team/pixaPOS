/**
 * Dev helper: render a sample bill (42-col, Rs. amounts) and push it through
 * the local print relay to the emulator. Run:
 * pnpm --filter @pixa/web exec tsx scripts/print-emulator-sample.ts [host] [port]
 * View the receipt at the emulator web UI (default http://localhost:3100).
 */
import { buildBillDoc } from "../features/print-studio/api/docs";
import { cutBytes, renderEscPos } from "../features/print-studio/api/render";
import type { BillingView } from "../features/orders/api/types";
import type { Outlet } from "../features/outlet/api/types";
import type { PrintTemplate } from "../features/print-studio/api/types";

const outlet = {
  id: "out_001",
  name: "PixaPOS Main Outlet",
  address_line_1: "123 MG Road",
  locality: "MG Road",
  city: "Ahmedabad",
  postal_code: "380015",
  phone: "9876543210",
  gstin: "24ABCDE1234F1Z5",
  fssai_number: "12345678901234",
} as Outlet;

const template = {
  id: "tmpl_bill",
  outlet_id: "out_001",
  purpose: "BILL",
  show_logo: false,
  header_lines: [],
  show_outlet_address: true,
  show_gstin: true,
  show_fssai: true,
  show_tax_breakup: true,
  show_payments: true,
  qr: "NONE",
  footer_lines: ["Thank you! Visit again"],
  show_powered_by: false,
  copies: 1,
  merchant_copy: false,
  cut_after: true,
  beep: false,
  auto_print: true,
  updated_at: new Date().toISOString(),
} as PrintTemplate;

const billing = {
  order: {
    id: "ord_1",
    order_number: "ORD-0001",
    channel: "dine_in",
    table_number_snapshot: "101",
    status: "COMPLETED",
    created_at: new Date().toISOString(),
    items: [
      {
        id: "li_1",
        item_name_snapshot: "Chicken Biryani",
        variant_name_snapshot: "Half",
        unit_price_paise: 19900,
        tax_percent_snapshot: 5,
        modifiers: [],
        qty: 1,
        line_total_paise: 19900,
        line_tax_paise: 995,
      },
    ],
    subtotal_paise: 19900,
    tax_paise: 995,
    total_paise: 20895,
    grand_total_paise: 20895,
    payment_status: "PAID",
  },
  paid_paise: 20895,
  balance_paise: 0,
} as unknown as BillingView;

const doc = buildBillDoc({ billing, payments: [], outlet, template });
const body = renderEscPos(doc, "P58", 42);
const cut = cutBytes(true);
const bytes = new Uint8Array(body.length + cut.length);
bytes.set(body, 0);
bytes.set(cut, body.length);

let binary = "";
for (const b of bytes) binary += String.fromCharCode(b);

const relayHost = process.argv[2] ?? "localhost";
const relayPort = process.argv[3] ?? "3000";
const printerPort = process.argv[4] ?? "9100";

async function main(): Promise<void> {
  const res = await fetch(`http://${relayHost}:${relayPort}/api/print-relay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: "localhost",
      port: Number(printerPort),
      bytesBase64: Buffer.from(binary, "binary").toString("base64"),
    }),
  });
  console.log("relay:", res.status, await res.text());
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
