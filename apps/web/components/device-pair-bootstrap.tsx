"use client";

import { useEffect } from "react";
import { deviceId } from "@/lib/db/device";

/**
 * Silent device pairing: while online with a live session, bind this
 * browser to the outlet (sets the httpOnly pixa_device cookie) so the
 * middleware's offline grace keeps the app open when the network drops.
 * Idempotent and quiet — refreshes at most once a day.
 */
const LAST_PAIR_KEY = "pixaLastPair";

export default function PairDeviceBootstrap() {
  useEffect(() => {
    try {
      const last = Number(window.localStorage.getItem(LAST_PAIR_KEY) ?? 0);
      if (Date.now() - last < 24 * 60 * 60 * 1000) return;
      if (!window.navigator.onLine) return;
      void fetch("/api/device/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: deviceId() }),
      })
        .then((r) => {
          if (r.ok) window.localStorage.setItem(LAST_PAIR_KEY, String(Date.now()));
        })
        .catch(() => {});
    } catch {}
  }, []);
  return null;
}
