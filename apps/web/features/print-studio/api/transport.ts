/**
 * Print transports (Phase 1). Browsers cannot open raw TCP sockets, so the
 * default path posts bytes to a same-origin relay (Next route handler) that
 * forwards them over TCP to the printer/emulator. USB/Bluetooth hang off the
 * same interface when a native shell (Electron/Capacitor) is present.
 */
import type { Printer } from "./types";

export type SendResult = { ok: boolean; error?: string };

export interface PrintTransport {
  readonly id: string;
  send(printer: Printer, bytes: Uint8Array): Promise<SendResult>;
}

/** POST { printer, bytesBase64 } to a relay URL (default: local print relay). */
export class HttpRelayTransport implements PrintTransport {
  readonly id = "http-relay";
  constructor(private relayUrl = "/api/print-relay") {}
  async send(printer: Printer, bytes: Uint8Array): Promise<SendResult> {
    try {
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      const res = await fetch(this.relayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: printer.address,
          port: printer.port ?? 9100,
          bytesBase64: btoa(binary),
        }),
      });
      if (!res.ok) return { ok: false, error: `relay ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "relay failed" };
    }
  }
}

/** Download bytes as a .bin file (field debugging without any printer). */
export class FileDownloadTransport implements PrintTransport {
  readonly id = "file-download";
  async send(printer: Printer, bytes: Uint8Array): Promise<SendResult> {
    try {
      const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${printer.name.replace(/\s+/g, "-")}-${Date.now()}.bin`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "download failed" };
    }
  }
}
