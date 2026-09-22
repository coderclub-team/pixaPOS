/**
 * ESC/POS renderer (Phase 1). PrintDoc -> raw bytes for thermal printers and
 * the emulator, plus a plain-text preview sharing the same layout math.
 * Targets 203dpi class (Font A widths from PAPER_PROFILES).
 */
import { PAPER_PROFILES, type PaperSize } from "./types";
import type { PrintDoc } from "./docs";

const ESC = 0x1b;
const GS = 0x1d;

export function charsFor(paper: PaperSize): number {
  return PAPER_PROFILES[paper].chars;
}

const TRANSLITERATE: Record<string, string> = {
  "₹": "Rs.",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "–": "-",
  "—": "-",
  "…": "...",
  "•": "-",
  "°": "deg",
};

/** ASCII-safe receipt text: transliterate known glyphs, drop the rest so
 * column math stays honest on legacy printer code pages. */
export function sanitizeReceiptText(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch >= " " && ch <= "~") out += ch;
    else if (TRANSLITERATE[ch] !== undefined) out += TRANSLITERATE[ch];
    else if (ch === "\n" || ch === "\t") out += " ";
    else out += "?";
  }
  return out;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (w.length > width) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      for (let i = 0; i < w.length; i += width) out.push(w.slice(i, i + width));
      continue;
    }
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > width) {
      out.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out.length > 0 ? out : [""];
}

function align(text: string, width: number, mode: "left" | "center" | "right"): string {
  if (text.length >= width) return text.slice(0, width);
  if (mode === "center") {
    const pad = width - text.length;
    const left = Math.floor(pad / 2);
    return " ".repeat(left) + text + " ".repeat(pad - left);
  }
  if (mode === "right") return " ".repeat(width - text.length) + text;
  return text + " ".repeat(width - text.length);
}

function pair(left: string, right: string, width: number): string[] {
  if (left.length + 1 + right.length <= width) {
    return [left + " ".repeat(width - left.length - right.length) + right];
  }
  const lines = wrap(left, width - right.length - 1);
  const last = lines.pop() ?? "";
  return [...lines, last + " ".repeat(width - last.length - right.length) + right];
}

/** Plain-text preview lines (also the emulator-readable layout). */
export function renderText(doc: PrintDoc, paper: PaperSize, cols?: number): string[] {
  const width = cols ?? charsFor(paper);
  const out: string[] = [];
  for (const line of doc.lines) {
    switch (line.kind) {
      case "rule":
        out.push("-".repeat(width));
        break;
      case "feed":
        for (let i = 0; i < line.lines; i++) out.push("");
        break;
      case "qr":
        out.push(align("[QR]", width, "center"));
        if (line.label) out.push(align(sanitizeReceiptText(line.label), width, "center"));
        break;
      case "pair":
        out.push(...pair(sanitizeReceiptText(line.left), sanitizeReceiptText(line.right), width));
        break;
      case "text": {
        const clean = sanitizeReceiptText(line.text);
        out.push(...wrap(clean, width).map((t) => align(t, width, line.align ?? "left")));
        break;
      }
    }
  }
  return out;
}

/** QR via GS ( k — model 2, auto size/ECC, print. Raw data capped at 400 bytes. */
function qrBytes(data: string): number[] {
  const raw = Buffer.from(data.slice(0, 400), "utf8");
  const out: number[] = [];
  const store = (fn: number, payload: number[]) => {
    const len = payload.length + 3;
    out.push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, fn, ...payload);
  };
  store(0x41, [0x32, 0x00]); // model 2
  store(0x43, [0x04]); // module size
  store(0x45, [0x31]); // ECC level M
  const d = [...raw];
  const len = d.length + 3;
  out.push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...d); // store
  const plen = 3;
  out.push(GS, 0x28, 0x6b, plen & 0xff, (plen >> 8) & 0xff, 0x31, 0x51, 0x30); // print
  return out;
}

/** PrintDoc -> ESC/POS byte array. `cols` overrides the paper default. */
export function renderEscPos(doc: PrintDoc, paper: PaperSize, cols?: number): Uint8Array {
  const text = renderText(doc, paper, cols);
  const width = cols ?? charsFor(paper);
  const out: number[] = [ESC, 0x40]; // init
  // Map preview lines back through doc lines for style bytes.
  let ti = 0;
  const pushText = (
    s: string,
    opts?: { bold?: boolean; double?: boolean; align?: "left" | "center" | "right" },
  ) => {
    const a = opts?.align === "center" ? 1 : opts?.align === "right" ? 2 : 0;
    out.push(ESC, 0x61, a);
    if (opts?.bold) out.push(ESC, 0x45, 0x01);
    if (opts?.double) out.push(GS, 0x21, 0x11);
    for (const ch of Buffer.from(s, "utf8")) out.push(ch);
    out.push(0x0a);
    if (opts?.double) out.push(GS, 0x21, 0x00);
    if (opts?.bold) out.push(ESC, 0x45, 0x00);
    out.push(ESC, 0x61, 0x00);
  };
  for (const line of doc.lines) {
    switch (line.kind) {
      case "rule":
      case "feed":
      case "pair":
      case "text": {
        const count =
          line.kind === "text" || line.kind === "pair"
            ? renderText({ lines: [line], hash: "" }, paper, cols).length
            : line.kind === "rule"
              ? 1
              : line.lines;
        for (let i = 0; i < count; i++) {
          const s = text[ti++] ?? "";
          if (line.kind === "text") pushText(s, line);
          else if (line.kind === "pair") pushText(s, { bold: line.bold });
          else pushText(s);
        }
        break;
      }
      case "qr": {
        out.push(ESC, 0x61, 0x01);
        out.push(...qrBytes(line.data));
        out.push(0x0a);
        if (line.label)
          pushText(align(sanitizeReceiptText(line.label), width, "center"), { align: "center" });
        out.push(ESC, 0x61, 0x00);
        break;
      }
    }
  }
  return Uint8Array.from(out);
}

/** Paper cut (GS V) + feed trailer. */
export function cutBytes(partial = true): Uint8Array {
  return Uint8Array.from([0x0a, 0x0a, 0x0a, GS, 0x56, partial ? 0x01 : 0x00]);
}

/** Cash-drawer kick / beep (ESC B). */
export function beepBytes(repeats = 2): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < repeats; i++) out.push(ESC, 0x42, 0x02, 0x02);
  return Uint8Array.from(out);
}
