"use client";

import { useRef, useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pixa/ui/base-ui/dialog";
import { Label } from "@pixa/ui/base-ui/label";
import { Switch } from "@pixa/ui/base-ui/switch";
import { Icons } from "@pixa/ui/icons";
import { toast } from "sonner";
import {
  collectSnapshot,
  downloadAutoSnapshot,
  downloadSnapshot,
  listSnapshots,
  restoreSnapshotFile,
  setSnapshotPrefs,
  snapshotPrefs,
  type SnapshotMeta,
} from "../api/service";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function SnapshotPanel() {
  const [snaps, setSnaps] = useState<SnapshotMeta[]>(() => listSnapshots());
  const [auto, setAuto] = useState(() => snapshotPrefs().auto_enabled);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setSnaps(listSnapshots());

  const onDownload = () => {
    try {
      downloadSnapshot();
      toast.success("Snapshot downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const onNow = () => {
    // Manual backup is a download; the auto ring stays automatic-only.
    onDownload();
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setPendingFile(f);
    setRestoreOpen(true);
  };

  const onRestore = async () => {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      await restoreSnapshotFile(pendingFile);
      // restores reload the tab; reaching here means it failed silently
      setRestoring(false);
    } catch (e) {
      setRestoring(false);
      setRestoreOpen(false);
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const bytes = (() => {
    try {
      return JSON.stringify(collectSnapshot()).length;
    } catch {
      return 0;
    }
  })();

  return (
    <>
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-left text-xl font-bold">Data & Backups</CardTitle>
          <CardDescription>
            Snapshots capture every local datastore (menu, orders, KOTs, payments, tables,
            customers, events…). Restore overwrites local data on this device, then reloads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">Manual backup</p>
              <p className="text-sm text-muted-foreground">
                Current footprint ≈ {formatBytes(bytes)} · downloads a JSON snapshot file.
              </p>
            </div>
            <Button onClick={onNow}>
              <Icons.download className="size-4" /> Download now
            </Button>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Daily auto-backup</p>
                <p className="text-sm text-muted-foreground">
                  Keeps the last 5 on this device — newest first.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor="auto-snap" className="text-xs text-muted-foreground">
                  Enabled
                </Label>
                <Switch
                  id="auto-snap"
                  checked={auto}
                  onCheckedChange={(v) => {
                    setAuto(v);
                    setSnapshotPrefs({ auto_enabled: v });
                    toast.success(v ? "Auto-backup on" : "Auto-backup off");
                  }}
                />
              </div>
            </div>
            {snaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No auto-backups yet — the first is taken on next launch after 24 h.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {snaps.map((s) => (
                  <li key={s.taken_at} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {new Date(s.taken_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatBytes(s.bytes)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          downloadAutoSnapshot(s.taken_at);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Download failed");
                          refresh();
                        }
                      }}
                    >
                      <Icons.download className="size-3.5" /> File
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-destructive/40 p-4">
            <div>
              <p className="font-medium">Restore from file</p>
              <p className="text-sm text-muted-foreground">
                Replaces all local data with the snapshot, then reloads every tab.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button variant="destructive" onClick={() => fileRef.current?.click()}>
              <Icons.upload className="size-4" /> Choose snapshot file…
            </Button>
          </section>
        </CardContent>
      </Card>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this snapshot?</DialogTitle>
            <DialogDescription>
              {pendingFile?.name} — all current local data on this device will be replaced. Download
              a backup first if you are unsure.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoring}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onRestore} disabled={restoring}>
              {restoring ? "Restoring…" : "Restore & reload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
