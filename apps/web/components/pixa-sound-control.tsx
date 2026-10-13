"use client";

import { useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Label } from "@pixa/ui/base-ui/label";
import { Input } from "@pixa/ui/base-ui/input";
import { usePixaSound } from "@/hooks/use-pixa-sound";
import { loadPrefs, savePrefs, type NotificationPrefs } from "@/lib/realtime/prefs";
import { getActiveOutletId } from "@/features/outlet/api/queries";
import type { TerminalType } from "@/lib/realtime/types";

/**
 * Sound unlock + notification prefs. KDS shows "Enable Kitchen Sound"
 * (autoplay policy needs the gesture); POS shows per-source toggles.
 */
export function PixaSoundControl({ terminal }: { terminal: TerminalType }) {
  const { settings, setSettings, unlocked, unlock, play } = usePixaSound();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadPrefs());

  const persistPrefs = (p: NotificationPrefs) => {
    setPrefs(p);
    savePrefs(p);
    // Best-effort server mirror (never blocks UI)
    try {
      const outletId = getActiveOutletId() ?? "out_001";
      void fetch(`/api/notification-prefs?outletId=${encodeURIComponent(outletId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs: p }),
        credentials: "include",
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => {
          if (!unlocked) unlock();
          setOpen(true);
        }}
        title={unlocked ? "Sound settings" : "Enable sound"}
        aria-label={unlocked ? "Sound settings" : "Enable sound"}
      >
        <Icons.notification
          className={settings.enabled && unlocked ? "size-4" : "size-4 opacity-40"}
        />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{terminal === "KDS" ? "Kitchen sound" : "Notification sound"}</DialogTitle>
            <DialogDescription>
              {unlocked
                ? "Toasts show for new orders and tickets; sound follows these settings."
                : "Browsers block audio until you tap Enable — tap it once per device."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!unlocked && (
              <Button
                onClick={() => {
                  unlock();
                  play("kot");
                }}
              >
                Enable {terminal === "KDS" ? "Kitchen Sound" : "Sound"}
              </Button>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              Sound enabled
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Volume ({Math.round(settings.volume * 100)}%)
              </Label>
              <Input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.volume * 100)}
                onChange={(e) => setSettings({ ...settings, volume: Number(e.target.value) / 100 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Repeat (1–3)</Label>
              <Input
                type="number"
                min={1}
                max={3}
                value={settings.repeat}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    repeat: Math.min(3, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
            {terminal === "POS" && (
              <div className="space-y-1.5 border-t pt-2">
                <Label className="text-xs text-muted-foreground">Notify me for</Label>
                {(
                  [
                    ["qr", "QR orders"],
                    ["kiosk", "Kiosk orders"],
                    ["online", "Online orders"],
                    ["captain", "Captain orders"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={prefs.pos[k]}
                      onChange={(e) =>
                        persistPrefs({ ...prefs, pos: { ...prefs.pos, [k]: e.target.checked } })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
