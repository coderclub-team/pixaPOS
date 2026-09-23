/**
 * Golden check for Print Studio Phase 1 (run: pnpm --filter @pixa/web exec tsx scripts/print-golden-check.ts).
 * Builds sample bill/KOT/token docs, asserts layout invariants per paper size,
 * and asserts ESC/POS framing bytes. Exits non-zero on any failure.
 */
import { buildBillDoc, buildKOTDoc, buildTokenDoc } from "../features/print-studio/api/docs";
import {
  charsFor,
  cutBytes,
  qrBytes,
  rasterBytes,
  renderEscPos,
  renderText,
} from "../features/print-studio/api/render";
import { PAPER_PROFILES, type PaperSize } from "../features/print-studio/api/types";
import type { BillingView } from "../features/orders/api/types";
import type { Payment } from "../features/payments/api/types";
import type { KitchenTicket } from "../features/kitchen/api/types";
import type { Outlet } from "../features/outlet/api/types";
import type { PrintTemplate } from "../features/print-studio/api/types";
import { activeUpiId } from "../features/outlet/api/types";
import { enqueuePrint } from "../features/print-studio/api/service";
import { floydSteinberg } from "../features/print-studio/api/logo";
import { effectiveChars, effectiveDots } from "../features/print-studio/api/types";
import { printerSupportsRaster } from "../features/print-studio/api/service";

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
    paper: "PRINTER",
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
  // GS ( k framing: pL/pH must equal cn+fn+payload (model cmd = 04 00 31 41).
  check(
    `qr framing valid ${paper}`,
    joined.includes(String.fromCharCode(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41)),
  );
  // QR store carries the Epson mode byte 0x30 (31 50 30) by default —
  // python-escpos convention for real hardware. Opt-out variant (escpresso)
  // drops it and shortens pL by one.
  check(`qr store mode byte ${paper}`, joined.includes(String.fromCharCode(0x31, 0x50, 0x30)));
  {
    const noMode = qrBytes("upi://pay?pa=a@b", false);
    const hex = String.fromCharCode(...noMode);
    check(
      `qr opt-out drops mode byte ${paper}`,
      !hex.includes(String.fromCharCode(0x31, 0x50, 0x30)) &&
        hex.includes(String.fromCharCode(0x1d, 0x28, 0x6b)),
    );
  }
  check(
    `ascii only ${paper}`,
    billText.every((l) => [...l].every((ch) => ch.charCodeAt(0) < 128)),
  );
  check(
    `rupee as Rs ${paper}`,
    billText.some((l) => l.includes("Rs.")) && !billText.some((l) => l.includes("₹")),
  );
}

// Epson Font A reality: 58mm printers fit 42 cols, not the 48-col profile.
{
  const bill = buildBillDoc({
    billing,
    payments,
    outlet,
    template: template("BILL"),
    upiId: "spiceroute@upi",
  });
  const narrow = renderText(bill, "P58", 42);
  check(
    "bill fits 42 cols",
    narrow.every((l) => l.length <= 42),
    `max=${Math.max(...narrow.map((l) => l.length))}`,
  );
  check(
    "42-col keeps grand total",
    narrow.some((l) => l.includes("GRAND TOTAL") && l.includes("Rs.")),
  );
}

// QR invalidation: collect-QR only while balance is outstanding, carrying the
// order ref (tr) and the outstanding amount — never a settled full-total QR.
{
  const owing = buildBillDoc({
    billing: { ...billing, paid_paise: 20000, balance_paise: 50000 },
    payments,
    outlet,
    template: template("BILL"),
    upiId: "spiceroute@upi",
    upiTr: "A-1024",
    qrAmountPaise: 50000,
  });
  const owingText = renderText(owing, "P80");
  check(
    "owing bill shows QR",
    owingText.some((l) => l.includes("[QR]")),
  );
  check(
    "owing QR is collect-type",
    owingText.some((l) => l.includes("Scan to pay")),
  );

  const settled = buildBillDoc({
    billing,
    payments,
    outlet,
    template: template("BILL"),
  });
  check("settled bill shows no QR", !renderText(settled, "P80").some((l) => l.includes("[QR]")));
}

console.log(failures === 0 ? "\nALL GOLDEN CHECKS PASSED (sync)" : `\n${failures} FAILURES`);

async function asyncChecks(): Promise<void> {
  // Logo raster framing: 16x8 checkerboard -> GS v 0 m=0, xL=2, yL=8, 16 bytes.
  const checker = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (x + y) % 2 === 0),
  );
  const raster = rasterBytes(checker);
  check(
    "raster framing",
    raster[0] === 0x1d &&
      raster[1] === 0x76 &&
      raster[2] === 0x30 &&
      raster[3] === 0x00 &&
      raster[4] === 2 &&
      raster[5] === 0 &&
      raster[6] === 8 &&
      raster[7] === 0 &&
      raster.length === 8 + 16,
  );
  const logoBill = buildBillDoc({
    billing,
    payments,
    outlet,
    template: template("BILL"),
    logoRows: checker,
  });
  check("logo bill starts with image", logoBill.lines[0].kind === "image");
  check("logo preview marker", renderText(logoBill, "P80")[0].includes("[LOGO]"));
  const logoKot = buildKOTDoc({ ticket, outlet, template: template("KOT"), logoRows: checker });
  check("logo KOT starts with image", logoKot.lines[0].kind === "image");
  const logoToken = buildTokenDoc({
    orderNumber: "A-1024",
    tokenNo: "T-42",
    outlet,
    template: template("TOKEN"),
    logoRows: checker,
  });
  check("logo token starts with image", logoToken.lines[0].kind === "image");
  // Tracking QR: ORDER kind + base URL prints it on token and KOT.
  const trackedToken = buildTokenDoc({
    orderNumber: "A-1024",
    tokenNo: "T-42",
    outlet,
    template: {
      ...template("TOKEN"),
      qr: "ORDER",
      tracking_base_url: "https://order.pixapos.store/t/",
    },
    trackingUrl: "https://order.pixapos.store/t/T-42",
  });
  check(
    "token tracking QR prints",
    renderText(trackedToken, "P80").some((l) => l.includes("[QR]")),
  );
  const trackedKot = buildKOTDoc({
    ticket,
    outlet,
    template: { ...template("KOT"), qr: "ORDER" },
    trackingUrl: "https://order.pixapos.store/t/A-1024",
  });
  check(
    "KOT tracking QR prints",
    renderText(trackedKot, "P80").some((l) => l.includes("[QR]")),
  );
  const quietKot = buildKOTDoc({ ticket, outlet, template: template("KOT") });
  check("KOT default has no QR", !renderText(quietKot, "P80").some((l) => l.includes("[QR]")));
  // Dither preserves tone: 32-step gray ramp should heat ~half the dots
  // (flat threshold would cliff at the midpoint with banding).
  const ramp = Array.from({ length: 16 }, () =>
    Array.from({ length: 32 }, (_, x) => Math.round((x / 31) * 255)),
  );
  const dithered = floydSteinberg(ramp);
  const total = 16 * 32;
  const heated = dithered.flat().filter(Boolean).length;
  const ratio = heated / total;
  check("dither keeps dims", dithered.length === 16 && dithered.every((r) => r.length === 32));
  check("dither preserves mid tone", ratio > 0.4 && ratio < 0.6, `ratio=${ratio.toFixed(2)}`);
  const leftHeat = dithered.flatMap((r) => r.slice(0, 8)).filter(Boolean).length;
  const rightHeat = dithered.flatMap((r) => r.slice(24)).filter(Boolean).length;
  check("dither gradients dark-to-light", leftHeat > rightHeat + 40);
  // Template paper resolution: printer override > template > printer profile.
  check(
    "printer override wins",
    effectiveChars({ paper: "P58" }, { paper: "P80", chars_per_line: 42 }) === 42,
  );
  check("template fixed wins", effectiveChars({ paper: "P58" }, { paper: "P80" }) === 48);
  check(
    "template PRINTER follows printer",
    effectiveChars({ paper: "PRINTER" }, { paper: "P78" }) === 72,
  );
  check("dots follow chars", effectiveDots({ paper: "P58" }, { paper: "P80" }) === 384);
  // Raster capability: explicit flag wins; localhost unset means incapable.
  const lan = { address: "192.168.1.50" } as never;
  const local = { address: "localhost" } as never;
  check("lan unset capable", printerSupportsRaster(lan) === true);
  check("localhost unset incapable", printerSupportsRaster(local) === false);
  check(
    "explicit wins",
    printerSupportsRaster({ address: "localhost", supports_raster: true } as never) === true &&
      printerSupportsRaster({ address: "192.168.1.50", supports_raster: false } as never) === false,
  ); // Never-throw enqueue: missing order / no printer leaves a FAILED trace.
  const job = await enqueuePrint("BILL", "order_that_does_not_exist");
  check("failed assemble parks FAILED job", job.status === "FAILED" && !!job.last_error);
  check("parked job carries gate reasons", job.qr === "error");
  // Multi-UPI default resolution: exactly one default feeds the QR.
  const multi = {
    upi_ids: [
      { id: "u1", label: "Owner", vpa: "owner@upi", is_active: false, created_at: "" },
      { id: "u2", label: "Counter", vpa: "counter@upi", is_active: true, created_at: "" },
    ],
  };
  check("default VPA resolves", activeUpiId(multi as never) === "counter@upi");
  check("none active disables QR", activeUpiId({ upi_ids: [] } as never) === null);

  console.log(failures === 0 ? "ALL GOLDEN CHECKS PASSED" : `${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

asyncChecks().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
