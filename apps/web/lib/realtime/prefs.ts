"use client";

export type PosPrefs = {
  qr: boolean;
  kiosk: boolean;
  online: boolean;
  captain: boolean;
  sound: boolean;
};

export type KdsPrefs = {
  newKot: boolean;
  voided: boolean;
  sound: boolean;
};

export type NotificationPrefs = {
  pos: PosPrefs;
  kds: KdsPrefs;
};

const KEY = "pixa:notify-prefs";

const DEFAULTS: NotificationPrefs = {
  pos: { qr: true, kiosk: true, online: true, captain: true, sound: true },
  kds: { newKot: true, voided: true, sound: true },
};

export function loadPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      pos: { ...DEFAULTS.pos, ...(p.pos ?? {}) },
      kds: { ...DEFAULTS.kds, ...(p.kds ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(p: NotificationPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** POS per-source gate: should a toast/sound fire for this source? */
export function posSourceEnabled(prefs: NotificationPrefs, source?: string): boolean {
  switch (source) {
    case "QR":
      return prefs.pos.qr;
    case "KIOSK":
      return prefs.pos.kiosk;
    case "WEBSITE":
      return prefs.pos.online;
    case "CAPTAIN":
      return prefs.pos.captain;
    case "POS":
      return false; // own orders never notify
    default:
      return true;
  }
}
