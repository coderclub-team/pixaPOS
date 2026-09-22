/**
 * Golden check for Print Studio Phase 1 (run: pnpm --filter @pixa/web exec tsx scripts/print-golden-check.ts).
 * Builds sample bill/KOT/token docs, asserts layout invariants per paper size,
 * and asserts ESC/POS framing bytes. Exits non-zero on any failure.
 */
import { buildBillDoc, buildKOTDoc, buildTokenDoc } from "../features/print-studio/api/docs";
import { charsFor, cutBytes, renderEscPos, renderText } from "../features/print-studio/api/render";
import { PAPER_PROFILES, type PaperSize } from "../features/print-studio/api/types";
import type { BillingView } from "../features/orders/api/types";
import type { Payment } from "../features/payments/api/types";
import type { KitchenTicket } from "../features/kitchen/api/types";
import type { Outlet } from "../features/outlet/api/types";
import type { PrintTemplate } from "../features/print-studio/api/types";

let failures = 0;
function check(name: string, cond: boolean, extra = ""): void {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${extra}`);
  }
}

const outlet = {
  id: "out_001",
  name: " Spice Route ",
  address_line_1: "12 Food Street",
  locality: "Indiranagar",
  city: "Bengaluru",
  postal_code: "560038",
  phone: "9880011223",
  gstin: "29ABCDE1234F1Z5",
  fssai_number: "11223344556677",
} as Outlet;

function template(purpose: PrintTemplate["purpose"]): PrintTemplate {
  return {
    id: `tmpl_${purpose}`,
    outlet_id: "out_001",
    purpose,
    show_logo: false,
    header_lines: ["Spice Route"],
    show_outlet_address: true,
    show_gstin: true,
    show_fssai: true,
    show_tax_breakup: true,
    show_payments: purpose === "BILL",
    qr: purpose === "BILL" ? "UPI" : purpose === "TOKEN" ? "ORDER" : "NONE",
    footer_lines: ["Thank you! Visit again"],
    show_powered_by: false,
    copies: 1,
    merchant_copy: purpose === "BILL",
    cut_after: true,
    beep: false,
    auto_print: true,
    updated_at: new Date().toISOString(),
  };
}

const billing = {
  order: {
    id: "ord_1",
    order_number: "A-1024",
    channel: "dine_in",
    table_number_snapshot: "T-07",
    customer_name: "Asha",
    status: "COMPLETED",
    created_at: new Date().toISOString(),
    items: [
      {
        id: "li_1",
        item_name_snapshot: "Paneer Butter Masala",
        variant_name_snapshot: "Full",
        unit_price_paise: 26000,
        tax_percent_snapshot: 5,
        modifiers: [{ modifier_id: "m1", name_snapshot: "Extra Cheese", price_paise: 4000 }],
        qty: 2,
        line_total_paise: 52000,
        line_tax_paise: 2600,
        instructions: "Less spicy",
      },
      {
        id: "li_2",
        item_name_snapshot: "Jeera Rice",
        unit_price_paise: 18000,
        tax_percent_snapshot: 5,
        modifiers: [],
        qty: 1,
        line_total_paise: 18000,
        line_tax_paise: 900,
      },
    ],
    subtotal_paise: 70000,
    tax_paise: 3500,
    total_paise: 73500,
    discount_paise: 3500,
    discount_reason: "STAFF10",
    grand_total_paise: 70000,
    payment_status: "PAID",
  },
  paid_paise: 70000,
  balance_paise: 0,
} as unknown as BillingView;

const payments = [
  {
    id: "pay_1",
    method: "upi",
    amount_paise: 70000,
    status: "PAID",
    created_at: new Date().toISOString(),
  },
] as Payment[];

const ticket = {
  id: "kot_1",
  order_number_snapshot: "A-1024",
  table_number_snapshot: "T-07",
  channel: "dine_in",
  kot_number: 7,
  status: "READY",
  fired_by: "captain-1",
  fired_at: new Date().toISOString(),
  lines: [
    {
      id: "kl_1",
      item_name_snapshot: "Paneer Butter Masala",
      variant_name_snapshot: "Full",
      modifiers_snapshot: ["Extra Cheese"],
      instructions: "Less spicy",
      qty: 2,
      voided_qty: 0,
      returned_qty: 0,
      status: "READY",
    },
  ],
  voids: [],
  returns: [],
} as unknown as KitchenTicket;

const papers: PaperSize[] = ["P58", "P78", "P80"];
for (const paper of papers) {
  const width = charsFor(paper);
  check(`profile ${paper} width`, width === PAPER_PROFILES[paper].chars);

  const bill = buildBillDoc({
    billing,
    payments,
    outlet,
    template: template("BILL"),
    upiId: "spiceroute@upi",
  });
  const billText = renderText(bill, paper);
  check(
    `bill fits ${paper}`,
    billText.every((l) => l.length <= width),
    `max=${Math.max(...billText.map((l) => l.length))}`,
  );
  check(
    `bill has grand total ${paper}`,
    billText.some((l) => l.includes("GRAND TOTAL") && l.includes("700.00")),
  );
  check(
    `bill has duplicate=false ${paper}`,
    billText.some((l) => l.includes("TAX INVOICE")),
  );
  check(
    `bill hash stable ${paper}`,
    buildBillDoc({ billing, payments, outlet, template: template("BILL"), upiId: "spiceroute@upi" })
      .hash === bill.hash,
  );

  const dup = buildBillDoc({
    billing,
    payments,
    outlet,
    template: template("BILL"),
    isDuplicate: true,
  });
  check(
    `duplicate differs ${paper}`,
    dup.hash !== bill.hash && renderText(dup, paper).some((l) => l.includes("DUPLICATE")),
  );

  const kot = buildKOTDoc({ ticket, outlet, template: template("KOT") });
  const kotText = renderText(kot, paper);
  check(
    `kot fits ${paper}`,
    kotText.every((l) => l.length <= width),
  );
  check(`kot has no prices ${paper}`, !kotText.some((l) => l.includes("₹")));

  const token = buildTokenDoc({
    orderNumber: "A-1024",
    tokenNo: "T-42",
    outlet,
    template: template("TOKEN"),
    trackingUrl: "https://order.pixapos.store/t/T-42",
    itemCount: 3,
  });
  check(
    `token fits ${paper}`,
    renderText(token, paper).every((l) => l.length <= width),
  );

  const bytes = renderEscPos(bill, paper);
  check(`esc init ${paper}`, bytes[0] === 0x1b && bytes[1] === 0x40);
  const cut = cutBytes(true);
  check(`cut framing ${paper}`, cut[3] === 0x1d && cut[4] === 0x56);
  const joined = Buffer.from(bytes).toString("binary");
  check(`qr command present ${paper}`, joined.includes(String.fromCharCode(0x1d, 0x28, 0x6b)));
}

console.log(failures === 0 ? "\nALL GOLDEN CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
