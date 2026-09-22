/**
 * Print Studio service (Phase 1). Printer registry, routing, templates, and
 * an idempotent print outbox. Only service commands mutate state, transition
 * jobs, and append print business events — UI calls commands, never stores.
 */
import { delay } from "@/constants/mock-api";
import { ulid } from "@pixa/contracts";
import { recordEvent } from "@/features/events/api/service";
import { getOrderById } from "@/features/orders/api/service";
import { getTicketById } from "@/features/kitchen/api/service";
import { getOutlet } from "@/features/outlet/api/service";
import { getPayments } from "@/features/payments/api/service";
import { buildBillDoc, buildKOTDoc, buildTokenDoc, type PrintDoc } from "./docs";
import { beepBytes, charsFor, cutBytes, renderEscPos } from "./render";
import { HttpRelayTransport, type PrintTransport } from "./transport";
import type {
  EBillPayload,
  Printer,
  PrinterPayload,
  PrintJob,
  PrintPurpose,
  PrintRoute,
  PrintTemplate,
} from "./types";

const PRINTER_KEY = "pixaPrinters";
const ROUTE_KEY = "pixaPrintRoutes";
const TEMPLATE_KEY = "pixaPrintTemplates";
const JOB_KEY = "pixaPrintJobs";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function save(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function now(): string {
  return new Date().toISOString();
}

const OUTLET_ID = "out_001";

function defaultTemplate(outlet_id: string, purpose: PrintPurpose): PrintTemplate {
  return {
    id: `tmpl_${purpose.toLowerCase()}`,
    outlet_id,
    purpose,
    show_logo: false,
    header_lines: [],
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
    beep: purpose === "BILL",
    auto_print: true,
    updated_at: now(),
  };
}

let transport: PrintTransport = new HttpRelayTransport();

/** Swap transport (tests, native shells). */
export function setPrintTransport(t: PrintTransport): void {
  transport = t;
}

/* ---------- registry ---------- */

export async function getPrinters(outlet_id = OUTLET_ID): Promise<Printer[]> {
  await delay(100);
  const printers = load<Printer[]>(PRINTER_KEY, []).filter((p) => p.outlet_id === outlet_id);
  if (printers.length > 0) return printers;
  // Localhost convenience: seed the emulator printer so local dev prints
  // without setup. Browser-only guard — never seeds on servers/deploys.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      const seed: Printer = {
        id: "prn_emulator",
        outlet_id,
        name: "Emulator (localhost:9100)",
        connection: "NETWORK",
        address: "localhost",
        port: 9100,
        paper: "P80",
        is_default: true,
        is_active: true,
        created_at: now(),
        updated_at: now(),
      };
      save(PRINTER_KEY, [seed]);
      return [seed];
    }
  }
  return printers;
}

export async function registerPrinter(
  payload: PrinterPayload,
  outlet_id = OUTLET_ID,
): Promise<Printer> {
  await delay(200);
  const printers = load<Printer[]>(PRINTER_KEY, []);
  const printer: Printer = {
    id: `prn_${ulid().toLowerCase()}`,
    outlet_id,
    port: payload.connection === "NETWORK" ? (payload.port ?? 9100) : undefined,
    is_default: printers.length === 0 ? true : (payload.is_default ?? false),
    is_active: payload.is_active ?? true,
    created_at: now(),
    updated_at: now(),
    ...payload,
  } as Printer;
  const next = (
    printer.is_default ? printers.map((p) => ({ ...p, is_default: false })) : printers
  ).concat(printer);
  save(PRINTER_KEY, next);
  return { ...printer };
}

export async function updatePrinter(id: string, payload: PrinterPayload): Promise<Printer | null> {
  await delay(200);
  const printers = load<Printer[]>(PRINTER_KEY, []);
  const idx = printers.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const updated = { ...printers[idx], ...payload, updated_at: now() };
  const next = (
    payload.is_default ? printers.map((p) => ({ ...p, is_default: false })) : printers
  ).slice();
  next[idx] = updated;
  save(PRINTER_KEY, next);
  return { ...updated };
}

export async function getDefaultPrinter(outlet_id = OUTLET_ID): Promise<Printer | null> {
  const printers = await getPrinters(outlet_id);
  return (
    printers.find((p) => p.is_default && p.is_active) ?? printers.find((p) => p.is_active) ?? null
  );
}

/* ---------- routing (v1: default route per purpose) ---------- */

export async function resolvePrinter(
  purpose: PrintPurpose,
  outlet_id = OUTLET_ID,
): Promise<Printer | null> {
  const routes = load<PrintRoute[]>(ROUTE_KEY, []).filter(
    (r) => r.outlet_id === outlet_id && r.purpose === purpose && r.is_active,
  );
  if (routes.length > 0) {
    const printers = await getPrinters(outlet_id);
    const hit = printers.find((p) => p.id === routes[0].printer_id && p.is_active);
    if (hit) return hit;
  }
  return getDefaultPrinter(outlet_id);
}

export async function saveRoute(
  route: Omit<PrintRoute, "id"> & { id?: string },
): Promise<PrintRoute> {
  await delay(150);
  const routes = load<PrintRoute[]>(ROUTE_KEY, []);
  if (route.id) {
    const next = routes.map((r) => (r.id === route.id ? { ...r, ...route } : r));
    save(ROUTE_KEY, next);
    return next.find((r) => r.id === route.id) as PrintRoute;
  }
  const created: PrintRoute = { ...route, id: `route_${ulid().toLowerCase()}` };
  save(ROUTE_KEY, [...routes, created]);
  return created;
}

/* ---------- templates ---------- */

export async function getTemplate(
  purpose: PrintPurpose,
  outlet_id = OUTLET_ID,
): Promise<PrintTemplate> {
  await delay(100);
  const found = load<PrintTemplate[]>(TEMPLATE_KEY, []).find(
    (t) => t.outlet_id === outlet_id && t.purpose === purpose,
  );
  return found ? { ...found } : defaultTemplate(outlet_id, purpose);
}

export async function saveTemplate(
  purpose: PrintPurpose,
  payload: Partial<PrintTemplate>,
  outlet_id = OUTLET_ID,
): Promise<PrintTemplate> {
  await delay(200);
  const templates = load<PrintTemplate[]>(TEMPLATE_KEY, []);
  const idx = templates.findIndex((t) => t.outlet_id === outlet_id && t.purpose === purpose);
  const merged = {
    ...defaultTemplate(outlet_id, purpose),
    ...(idx >= 0 ? templates[idx] : {}),
    ...payload,
    updated_at: now(),
  };
  const next =
    idx >= 0 ? templates.map((t, i) => (i === idx ? merged : t)) : [...templates, merged];
  save(TEMPLATE_KEY, next);
  return { ...merged };
}

/* ---------- doc assembly ---------- */

async function assembleDoc(
  purpose: PrintPurpose,
  ref_id: string,
  opts?: { isDuplicate?: boolean; reprintReason?: string },
): Promise<{ doc: PrintDoc; outlet_id: string; refLabel: string }> {
  const outlet = await getOutlet();
  const template = await getTemplate(purpose, outlet.id);
  if (purpose === "BILL") {
    const order = await getOrderById(ref_id);
    if (!order) throw new Error("order not found");
    const payments = await getPayments({ order_id: order.id });
    return {
      doc: buildBillDoc({
        billing: { order, paid_paise: 0, balance_paise: 0 },
        payments,
        outlet,
        template,
        isDuplicate: opts?.isDuplicate,
      }),
      outlet_id: outlet.id,
      refLabel: order.order_number,
    };
  }
  if (purpose === "KOT") {
    const ticket = await getTicketById(ref_id);
    if (!ticket) throw new Error("KOT not found");
    return {
      doc: buildKOTDoc({ ticket, outlet, template }),
      outlet_id: outlet.id,
      refLabel: `KOT-${ticket.kot_number}`,
    };
  }
  const order = await getOrderById(ref_id);
  if (!order) throw new Error("order not found");
  return {
    doc: buildTokenDoc({
      orderNumber: order.order_number,
      tokenNo: order.order_number,
      outlet,
      template,
    }),
    outlet_id: outlet.id,
    refLabel: order.order_number,
  };
}

/* ---------- outbox ---------- */

function readJobs(): PrintJob[] {
  return load<PrintJob[]>(JOB_KEY, []);
}

export async function getPrintJobs(outlet_id = OUTLET_ID): Promise<PrintJob[]> {
  await delay(100);
  return readJobs()
    .filter((j) => j.outlet_id === outlet_id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

async function sendJob(job: PrintJob, doc: PrintDoc, printer: Printer): Promise<void> {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  const fail = async (error: string) => {
    const updated = {
      ...job,
      status: "FAILED" as const,
      attempts: job.attempts + 1,
      last_error: error,
      updated_at: now(),
    };
    jobs[idx] = updated;
    save(JOB_KEY, jobs);
    await recordEvent({
      outlet_id: job.outlet_id,
      entity_type: "PRINT_JOB",
      entity_id: job.id,
      event_type: "PRINT_FAILED",
      reason_text: error,
      metadata: { purpose: job.purpose, ref_id: job.ref_id, attempt: updated.attempts },
    });
  };
  try {
    const template = await getTemplate(job.purpose, job.outlet_id);
    const cols = printer.chars_per_line ?? charsFor(printer.paper);
    let bytes = renderEscPos(doc, printer.paper, cols);
    const copies =
      Math.max(1, template.copies) +
      (template.merchant_copy && job.purpose === "BILL" && !job.is_reprint ? 1 : 0);
    for (let c = 0; c < copies; c++) {
      const chunk = template.cut_after ? concatBytes(bytes, cutBytes(true)) : bytes;
      const res = await transport.send(
        printer,
        template.beep && c === 0 ? concatBytes(chunk, beepBytes()) : chunk,
      );
      if (!res.ok) {
        await fail(res.error ?? "transport failed");
        return;
      }
    }
    const updated = {
      ...job,
      status: "SENT" as const,
      attempts: job.attempts + 1,
      updated_at: now(),
    };
    jobs[idx] = updated;
    save(JOB_KEY, jobs);
    await recordEvent({
      outlet_id: job.outlet_id,
      entity_type: "PRINT_JOB",
      entity_id: job.id,
      event_type: job.is_reprint
        ? job.purpose === "BILL"
          ? "BILL_REPRINTED"
          : "KOT_REPRINTED"
        : "PRINT_SENT",
      reason_text: job.reprint_reason,
      metadata: { purpose: job.purpose, ref_id: job.ref_id, copies, printer_id: printer.id },
      actor_id: job.created_by,
    });
  } catch (e) {
    await fail(e instanceof Error ? e.message : "send failed");
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Enqueue a print (auto-fire on KOT/collect/complete call this). Processes inline when online. */
export async function enqueuePrint(
  purpose: PrintPurpose,
  ref_id: string,
  opts?: { isDuplicate?: boolean; reprintReason?: string; created_by?: string },
): Promise<PrintJob> {
  const { doc, outlet_id } = await assembleDoc(purpose, ref_id, opts);
  const printer = await resolvePrinter(purpose, outlet_id);
  if (!printer) throw new Error("no active printer: add one in Print Studio settings");
  const job: PrintJob = {
    id: `pj_${ulid().toLowerCase()}`,
    outlet_id,
    purpose,
    ref_id,
    printer_id: printer.id,
    doc_hash: doc.hash,
    is_reprint: opts?.isDuplicate ?? false,
    reprint_reason: opts?.reprintReason,
    status: "QUEUED",
    attempts: 0,
    created_by: opts?.created_by,
    created_at: now(),
    updated_at: now(),
  };
  const jobs = readJobs();
  jobs.push(job);
  save(JOB_KEY, jobs);
  await recordEvent({
    outlet_id,
    entity_type: "PRINT_JOB",
    entity_id: job.id,
    event_type: "PRINT_QUEUED",
    metadata: { purpose, ref_id, printer_id: printer.id, doc_hash: doc.hash },
    actor_id: opts?.created_by,
  });
  await sendJob({ ...job }, doc, printer);
  const latest = readJobs().find((j) => j.id === job.id);
  return latest ?? job;
}

/** Auto-print guards: template flag on, printer resolvable. Never throw — a
 * failed auto-print leaves a QUEUED job for the outbox sweeper; the business
 * transition (fire/collect/complete) must never fail because of printing. */
export async function maybeAutoPrintKOT(ticket_id: string, by?: string): Promise<void> {
  try {
    const ticket = await getTicketById(ticket_id);
    if (!ticket) return;
    const template = await getTemplate("KOT", ticket.outlet_id);
    if (!template.auto_print) return;
    await enqueuePrint("KOT", ticket_id, { created_by: by });
  } catch (e) {
    console.error("[print-studio] auto KOT print failed", e);
  }
}

export async function maybeAutoPrintBill(order_id: string, by?: string): Promise<void> {
  try {
    const order = await getOrderById(order_id);
    if (!order) return;
    const [billTemplate, tokenTemplate] = await Promise.all([
      getTemplate("BILL", order.outlet_id),
      getTemplate("TOKEN", order.outlet_id),
    ]);
    if (billTemplate.auto_print) await enqueuePrint("BILL", order_id, { created_by: by });
    if (order.channel === "takeaway" && tokenTemplate.auto_print) {
      await enqueuePrint("TOKEN", order_id, { created_by: by });
    }
  } catch (e) {
    console.error("[print-studio] auto bill print failed", e);
  }
}

/** Reprint: new job on the immutable snapshot, audited with mandatory reason. */
export async function reprintDoc(
  purpose: Extract<PrintPurpose, "BILL" | "KOT">,
  ref_id: string,
  reason: string,
  created_by?: string,
): Promise<PrintJob> {
  if (!reason.trim()) throw new Error("reprint reason is required");
  return enqueuePrint(purpose, ref_id, {
    isDuplicate: true,
    reprintReason: reason.trim(),
    created_by,
  });
}

/** Retry all queued/failed jobs (outbox sweeper + manual retry button). */
export async function retryFailedJobs(outlet_id = OUTLET_ID): Promise<number> {
  const pending = readJobs().filter(
    (j) => j.outlet_id === outlet_id && (j.status === "QUEUED" || j.status === "FAILED"),
  );
  const printers = await getPrinters(outlet_id);
  let sent = 0;
  for (const job of pending) {
    const printer =
      printers.find((p) => p.id === job.printer_id && p.is_active) ??
      (await getDefaultPrinter(outlet_id));
    if (!printer) continue;
    const { doc } = await assembleDoc(job.purpose, job.ref_id).catch(() => ({
      doc: null as unknown as PrintDoc,
    }));
    if (!doc) continue;
    await sendJob(job, doc, printer);
    const latest = readJobs().find((j) => j.id === job.id);
    if (latest?.status === "SENT") sent++;
  }
  return sent;
}

/** Test print: static doc proving printer + paper profile without touching orders. */
export async function testPrint(printerId: string, created_by?: string): Promise<PrintJob> {
  const printers = await getPrinters();
  const printer = printers.find((p) => p.id === printerId);
  if (!printer) throw new Error("printer not found");
  const outlet = await getOutlet();
  const template = await getTemplate("TOKEN", outlet.id);
  const doc = buildTokenDoc({ orderNumber: "TEST", tokenNo: "TEST", outlet, template });
  const job: PrintJob = {
    id: `pj_${ulid().toLowerCase()}`,
    outlet_id: outlet.id,
    purpose: "TOKEN",
    ref_id: "TEST",
    printer_id: printer.id,
    doc_hash: "test",
    is_reprint: false,
    status: "QUEUED",
    attempts: 0,
    created_by,
    created_at: now(),
    updated_at: now(),
  };
  const jobs = readJobs();
  jobs.push(job);
  save(JOB_KEY, jobs);
  await sendJob({ ...job }, doc, printer);
  return readJobs().find((j) => j.id === job.id) ?? job;
}

/** eBill payload builder (Phase 2 providers plug in here; no SMS/WhatsApp API yet). */
export async function buildEBill(
  order_id: string,
  channel: EBillPayload["channel"],
): Promise<EBillPayload> {
  const order = await getOrderById(order_id);
  if (!order) throw new Error("order not found");
  if (!order.customer_phone) throw new Error("order has no customer phone for eBill");
  const outlet = await getOutlet();
  return {
    order_id,
    order_number: order.order_number,
    outlet_name: outlet.name,
    grand_total_paise: order.grand_total_paise,
    channel,
    recipient_phone: order.customer_phone,
  };
}
