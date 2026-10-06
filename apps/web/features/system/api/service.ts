/**
 * Data snapshots (Track 4): download / scheduled auto-backups / restore of
 * the local-first datastores. localStorage remains the source of truth and
 * the cross-tab bus — a snapshot is the raw value of every `pixa*` domain
 * key, so restore is a wholesale write + bump + reload.
 */

export const SNAPSHOT_VERSION = 1;

export const SNAPSHOT_KEYS = [
  "pixaMenu",
  "pixaOrders",
  "pixaReturns",
  "pixaKOTs",
  "pixaPayments",
  "pixaTables",
  "pixaFloors",
  "pixaCustomers",
  "pixaOutlet",
  "pixaEvents",
  "pixaBilling",
  "pixaPOs",
] as const;

export type Snapshot = {
  version: number;
  app: "pixapos-web";
  taken_at: string;
  data: Record<string, string | null>;
};

export type SnapshotMeta = {
  taken_at: string;
  bytes: number;
  auto: boolean;
};

const AUTO_RING_KEY = "pixaSnapshots";
const AUTO_AT_KEY = "pixaSnapshotsLastAuto";
const PREF_KEY = "pixaSnapshotPrefs";
const BUMP_KEY = "pixaLocalDbBump";
const AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_KEEP = 5;

export function snapshotPrefs(): { auto_enabled: boolean } {
  try {
    return { auto_enabled: true, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") };
  } catch {
    return { auto_enabled: true };
  }
}

export function setSnapshotPrefs(p: { auto_enabled: boolean }) {
  localStorage.setItem(PREF_KEY, JSON.stringify(p));
}

export function collectSnapshot(): Snapshot {
  const data: Record<string, string | null> = {};
  for (const key of SNAPSHOT_KEYS) {
    try {
      data[key] = localStorage.getItem(key);
    } catch {
      data[key] = null;
    }
  }
  return {
    version: SNAPSHOT_VERSION,
    app: "pixapos-web",
    taken_at: new Date().toISOString(),
    data,
  };
}

export function downloadSnapshot(snap: Snapshot = collectSnapshot()) {
  const blob = new Blob([JSON.stringify(snap)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pixapos-snapshot-${snap.taken_at.slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function readRing(): { meta: SnapshotMeta; snap: Snapshot }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(AUTO_RING_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function listSnapshots(): SnapshotMeta[] {
  return readRing().map((r) => r.meta);
}

/** Daily auto-backup ring (keeps the last 5). No-op on server. */
export function maybeAutoSnapshot(now = Date.now()) {
  try {
    if (!snapshotPrefs().auto_enabled) return;
    const last = Number(localStorage.getItem(AUTO_AT_KEY) ?? 0);
    if (now - last < AUTO_INTERVAL_MS) return;
    const snap = collectSnapshot();
    const bytes = JSON.stringify(snap).length;
    const ring = readRing();
    ring.unshift({
      meta: { taken_at: snap.taken_at, bytes, auto: true },
      snap,
    });
    // Quota-safe: drop oldest until the write fits.
    let kept = ring.slice(0, AUTO_KEEP);
    while (kept.length > 0) {
      try {
        localStorage.setItem(AUTO_RING_KEY, JSON.stringify(kept));
        break;
      } catch {
        kept = kept.slice(0, -1);
      }
    }
    localStorage.setItem(AUTO_AT_KEY, String(now));
  } catch {
    // Snapshots must never break boot.
  }
}

export function downloadAutoSnapshot(takenAt: string) {
  const found = readRing().find((r) => r.meta.taken_at === takenAt);
  if (!found) throw new Error("Snapshot no longer retained");
  downloadSnapshot(found.snap);
}

function parseSnapshot(json: string): Snapshot {
  const snap = JSON.parse(json) as Snapshot;
  if (snap?.app !== "pixapos-web" || typeof snap.data !== "object" || !snap.data) {
    throw new Error("Not a pixaPOS snapshot file");
  }
  for (const key of Object.keys(snap.data)) {
    if (!(SNAPSHOT_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Unknown snapshot key: ${key}`);
    }
  }
  return snap;
}

/**
 * Destructive restore: overwrites every domain key, bumps the cross-tab bus
 * so other tabs reload, then reloads this tab. Caller must confirm first.
 */
export function restoreSnapshot(json: string) {
  const snap = parseSnapshot(json);
  for (const key of SNAPSHOT_KEYS) {
    const value = snap.data[key];
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
  try {
    localStorage.setItem(BUMP_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  window.location.reload();
}

export async function restoreSnapshotFile(file: File) {
  restoreSnapshot(await file.text());
}
