"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@pixa/ui/base-ui/button";
import { Badge } from "@pixa/ui/base-ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import { Icons } from "@pixa/ui/icons";
import { PAPER_PROFILES, type Printer } from "../api/types";
import { testPrint, updatePrinter } from "../api/service";
import { printKeys } from "../api/queries";
import { toast } from "sonner";
import PrinterForm from "./printer-form";

export default function PrinterList({ printers }: { printers: Printer[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Printer | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: printKeys.all });
    setEditing(null);
  };

  const setDefaultMut = useMutation({
    mutationFn: (p: Printer) => updatePrinter(p.id, { ...toPayload(p), is_default: true }),
    onSuccess: () => {
      refresh();
      toast.success("Default printer updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (p: Printer) => updatePrinter(p.id, { ...toPayload(p), is_active: !p.is_active }),
    onSuccess: () => {
      refresh();
      toast.success("Printer updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (p: Printer) => testPrint(p.id),
    onSuccess: (job) => {
      refresh();
      if (job.status === "SENT") toast.success("Test print sent");
      else toast.error(job.last_error ?? "Test print failed — see history");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editing) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setEditing(null)}>
          Back to printers
        </Button>
        <PrinterForm
          editing={editing}
          initialData={printerValues(editing)}
          onDone={() => refresh()}
        />
      </div>
    );
  }

  if (printers.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No printers yet. Add the counter printer (or point one at the emulator on localhost:9100).
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {printers.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{p.name}</span>
              {p.is_default && <Badge variant="outline">Default</Badge>}
              {!p.is_active && <Badge variant="destructive">Off</Badge>}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {p.connection} · {p.address}
              {p.connection === "NETWORK" ? `:${p.port ?? 9100}` : ""} ·{" "}
              {PAPER_PROFILES[p.paper].label}
            </div>
            {(p.address === "localhost" || p.address === "127.0.0.1") && (
              <div className="truncate text-[11px] text-muted-foreground">
                Emulator builds don&apos;t render logo raster — toggle logo off for visual QA.
              </div>
            )}
          </div>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md p-0 hover:bg-muted">
              <Icons.ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setEditing(p)}>
                  <Icons.edit className="size-4" /> Edit
                </DropdownMenuItem>
                {!p.is_default && (
                  <DropdownMenuItem onClick={() => setDefaultMut.mutate(p)}>
                    <Icons.check className="size-4" /> Set default
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => testMut.mutate(p)}>
                  <Icons.refresh className="size-4" /> Test print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleMut.mutate(p)}>
                  <Icons.trash className="size-4" /> {p.is_active ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}

function printerValues(p: Printer) {
  return {
    name: p.name,
    connection: p.connection,
    address: p.address,
    port: p.port != null ? String(p.port) : "",
    paper: p.paper,
    chars_per_line: p.chars_per_line != null ? String(p.chars_per_line) : "",
    supports_raster: p.supports_raster ?? true,
    is_default: p.is_default,
    is_active: p.is_active,
  };
}

/** Form values -> domain payload (port string to number). */
function toPayload(p: Printer) {
  const v = printerValues(p);
  const port = v.port.trim() ? Number.parseInt(v.port, 10) : undefined;
  const cols = v.chars_per_line.trim() ? Number.parseInt(v.chars_per_line, 10) : undefined;
  return {
    ...v,
    port: port != null && Number.isFinite(port) ? port : undefined,
    chars_per_line: cols != null && Number.isFinite(cols) && cols > 0 ? cols : undefined,
  };
}
