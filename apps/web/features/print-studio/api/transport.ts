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

/** Known thermal-printer USB vendors for the WebUSB picker filter. */
export const USB_PRINTER_FILTERS: { vendorId: number }[] = [
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0416 }, // XPrinter
  { vendorId: 0x0fe6 }, // ICS Advent / mixed
  { vendorId: 0x0483 }, // STMicro (many compatibles)
];

/** Minimal WebUSB/Bluetooth typings (lib.dom lacks them without extra libs). */
type WebUSBDevice = {
  vendorId: number;
  productId: number;
  productName?: string;
  opened: boolean;
  open: () => Promise<void>;
  close: () => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  transferOut: (endpoint: number, data: BufferSource) => Promise<unknown>;
  configuration?: {
    interfaces: {
      interfaceNumber: number;
      alternates: { endpoints: { endpointNumber: number; direction: string; type: string }[] }[];
    }[];
  } | null;
};

function getUSB(): {
  requestDevice: (opts: unknown) => Promise<WebUSBDevice>;
  getDevices: () => Promise<WebUSBDevice[]>;
} | null {
  try {
    const nav = navigator as unknown as {
      usb?: {
        requestDevice: (opts: unknown) => Promise<WebUSBDevice>;
        getDevices: () => Promise<WebUSBDevice[]>;
      };
    };
    return nav.usb ?? null;
  } catch {
    return null;
  }
}

export function webUsbSupported(): boolean {
  return getUSB() !== null;
}

/** Prompt the OS USB picker; resolves a device descriptor string for storage. */
export async function requestUsbPrinter(): Promise<{ address: string; label: string }> {
  const usb = getUSB();
  if (!usb) throw new Error("WebUSB needs Chrome/Edge on localhost or HTTPS");
  const device = await usb.requestDevice({ filters: USB_PRINTER_FILTERS });
  const label =
    device.productName ?? `USB ${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
  return { address: `USB:${device.vendorId.toString(16)}:${device.productId.toString(16)}`, label };
}

/** USB printer chosen before (permission persists per origin). */
export async function pairedUsbPrinters(): Promise<{ address: string; label: string }[]> {
  const usb = getUSB();
  if (!usb) return [];
  const devices = await usb.getDevices().catch(() => []);
  return devices.map((d) => ({
    address: `USB:${d.vendorId.toString(16)}:${d.productId.toString(16)}`,
    label: d.productName ?? `USB ${d.vendorId.toString(16)}:${d.productId.toString(16)}`,
  }));
}

/** WebUSB thermal printing: first bulk-OUT endpoint, chunked writes. */
export class WebUSBTransport implements PrintTransport {
  readonly id = "webusb";
  async send(printer: Printer, bytes: Uint8Array): Promise<SendResult> {
    const usb = getUSB();
    if (!usb) return { ok: false, error: "WebUSB needs Chrome/Edge on localhost or HTTPS" };
    try {
      const [, vendor, product] = printer.address.split(":");
      const devices = await usb.getDevices();
      const device = devices.find(
        (d) => d.vendorId.toString(16) === vendor && d.productId.toString(16) === product,
      );
      if (!device) return { ok: false, error: "USB printer not paired — use Discover first" };
      await device.open();
      try {
        await device.claimInterface(0);
        const alt = device.configuration?.interfaces?.[0]?.alternates?.[0];
        const ep =
          alt?.endpoints?.find((e) => e.direction === "out" && e.type === "bulk")?.endpointNumber ??
          1;
        for (let i = 0; i < bytes.length; i += 4096) {
          await device.transferOut(ep, bytes.slice(i, i + 4096));
        }
      } finally {
        await device.close().catch(() => {});
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof Error && e.name === "NotFoundError")
        return { ok: false, error: "USB device not found" };
      return { ok: false, error: e instanceof Error ? e.message : "USB send failed" };
    }
  }
}

type BleDevice = {
  name?: string;
  gatt?: { connect: () => Promise<BleServer> };
};
type BleServer = {
  getPrimaryService: (uuid: string) => Promise<BleService>;
};
type BleService = {
  getCharacteristic: (uuid: string) => Promise<BleCharacteristic>;
};
type BleCharacteristic = {
  writeValue: (data: BufferSource) => Promise<void>;
};

/** Thermal printer BLE service/characteristic (commonly advertised). */
const PRINTER_SERVICE = "000018f0-0000-1000-8000-00805f9a34fb";
const PRINTER_CHAR = "00002af1-0000-1000-8000-00805f9a34fb";

function getBluetooth(): { requestDevice: (opts: unknown) => Promise<BleDevice> } | null {
  try {
    const nav = navigator as unknown as {
      bluetooth?: { requestDevice: (opts: unknown) => Promise<BleDevice> };
    };
    return nav.bluetooth ?? null;
  } catch {
    return null;
  }
}

export function webBluetoothSupported(): boolean {
  return getBluetooth() !== null;
}

/**
 * BLE scan for GATT printers. NOTE: classic-Bluetooth (SPP) receipt printers
 * — the majority — are invisible to browsers; no API exists. Those stay
 * manual-entry + native-shell.
 */
export async function requestBlePrinter(): Promise<{ address: string; label: string }> {
  const bt = getBluetooth();
  if (!bt) throw new Error("Web Bluetooth needs Chrome/Edge on localhost or HTTPS");
  const device = await bt.requestDevice({
    filters: [{ services: [PRINTER_SERVICE] }],
    optionalServices: [PRINTER_SERVICE],
  });
  const label = device.name ?? "BLE printer";
  return { address: `BT:${label}`, label };
}

/** BLE GATT printer writes (chunked to the printer characteristic). */
export class WebBluetoothTransport implements PrintTransport {
  readonly id = "webbluetooth";
  async send(printer: Printer, bytes: Uint8Array): Promise<SendResult> {
    const bt = getBluetooth();
    if (!bt) return { ok: false, error: "Web Bluetooth needs Chrome/Edge on localhost or HTTPS" };
    try {
      const device = await bt.requestDevice({
        filters: [{ services: [PRINTER_SERVICE] }],
        optionalServices: [PRINTER_SERVICE],
      });
      if (!device.gatt) return { ok: false, error: "No GATT server on device" };
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(PRINTER_SERVICE);
      const char = await service.getCharacteristic(PRINTER_CHAR);
      for (let i = 0; i < bytes.length; i += 512) {
        await char.writeValue(bytes.slice(i, i + 512));
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof Error && e.name === "NotFoundError")
        return { ok: false, error: "Bluetooth scan cancelled" };
      return { ok: false, error: e instanceof Error ? e.message : "Bluetooth send failed" };
    }
  }
}
