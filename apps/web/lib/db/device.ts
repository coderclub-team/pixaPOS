/**
 * Device identity: stable per browser, persisted in localStorage.
 * Registered server-side during the first sync (pilot phase); until then the
 * id acts as the outbox device origin and audit actor qualifier.
 */
import { ulid } from "@pixa/contracts";

const KEY = "pixaDeviceId";
const NAME_KEY = "pixaDeviceName";

export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `POS-${ulid().slice(-6)}`;
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* storage unavailable — ephemeral identity */
    }
  }
  return id;
}

export function deviceName(): string {
  if (typeof window === "undefined") return "server";
  return window.localStorage.getItem(NAME_KEY) ?? "Counter POS";
}

export function setDeviceName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* noop */
  }
}
