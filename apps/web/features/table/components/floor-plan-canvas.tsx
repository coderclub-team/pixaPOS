"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { moveTable, resizeTable } from "../api/service";
import { getFloorLayout } from "@/features/floor/api/service";
import { tableKeys } from "../api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import { cn } from "@pixa/ui/lib/utils";
import { Icons } from "@pixa/ui/icons";
import { Button } from "@pixa/ui/base-ui/button";
import type { TableWithDerived } from "../api/types";

interface FloorPlanCanvasProps {
  floorId: string;
  isEditable?: boolean;
  selectedTableId?: string;
  onSelectTable?: (tableId: string | null) => void;
}

type Pose = { x: number; y: number; w: number; h: number };
type DragSession = {
  tableId: string;
  mode: "move" | "resize";
  handle?: string;
  startPX: number;
  startPY: number;
  startMM: { x: number; y: number };
  orig: Pose;
  moved: boolean;
} | null;

const MIN_SIZE = 300;
const CLICK_THRESHOLD_PX = 4;

function renderTableShape(
  shape: string,
  w: number,
  h: number,
  className?: string
) {
  const cx = w / 2;
  const cy = h / 2;
  switch (shape) {
    case "round":
      return <circle cx={cx} cy={cy} r={w / 2} className={className} />;
    case "ellipse":
      return <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} className={className} />;
    case "triangle":
      return <polygon points={`${cx},0 0,${h} ${w},${h}`} className={className} />;
    case "half_circle":
      // Flat edge down; orientation follows rotation_deg
      return <path d={`M 0 ${h} A ${w / 2} ${h} 0 0 1 ${w} ${h} Z`} className={className} />;
    case "square":
    case "rectangle":
    default:
      return (
        <rect
          width={w}
          height={h}
          rx={shape === "square" ? 40 : 80}
          className={className}
        />
      );
  }
}

const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function handlePosition(handle: string, w: number, h: number): { x: number; y: number } {
  const xs: Record<string, number> = { w: 0, e: w };
  const ys: Record<string, number> = { n: 0, s: h };
  const xKey = handle.includes("w") ? "w" : handle.includes("e") ? "e" : undefined;
  const yKey = handle.includes("n") ? "n" : handle.includes("s") ? "s" : undefined;
  return {
    x: xKey ? xs[xKey]! : w / 2,
    y: yKey ? ys[yKey]! : h / 2,
  };
}

function handleCursor(handle: string): string {
  if (handle === "nw" || handle === "se") return "cursor-nwse-resize";
  if (handle === "ne" || handle === "sw") return "cursor-nesw-resize";
  if (handle === "n" || handle === "s") return "cursor-ns-resize";
  return "cursor-ew-resize";
}

export default function FloorPlanCanvas({
  floorId,
  isEditable = true,
  selectedTableId,
  onSelectTable,
}: FloorPlanCanvasProps) {
  const queryClient = useQueryClient();
  const { data: layout } = useSuspenseQuery({
    queryKey: [...floorKeys.all, "layout", floorId],
    queryFn: () => getFloorLayout(floorId),
  });

  const [editable, setEditable] = useState(isEditable);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 12000, h: 8000 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, Pose>>({});
  const dragRef = useRef<DragSession>(null);

  const grid = layout.floor.grid_size_mm || 100;
  const snap = (v: number) => Math.round(v / grid) * grid;

  const invalidateLayout = () => {
    queryClient.invalidateQueries({ queryKey: [...floorKeys.all, "layout", floorId] });
    queryClient.invalidateQueries({ queryKey: tableKeys.all });
  };

  const moveMut = useMutation({
    mutationFn: ({ id, x, y }: { id: string; x: number; y: number }) =>
      moveTable(id, { x_mm: x, y_mm: y }),
    onSettled: (_d, _e, vars) => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      invalidateLayout();
    },
  });

  const resizeMut = useMutation({
    mutationFn: ({ id, w, h }: { id: string; w: number; h: number }) =>
      resizeTable(id, { w_mm: w, h_mm: h }),
    onSettled: (_d, _e, vars) => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      invalidateLayout();
    },
  });

  const saving = moveMut.isPending || resizeMut.isPending;

  const toMm = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const effW = viewBox.w / zoom;
    const effH = viewBox.h / zoom;
    return {
      x: viewBox.x + ((clientX - rect.left) * effW) / rect.width,
      y: viewBox.y + ((clientY - rect.top) * effH) / rect.height,
    };
  };

  const poseOf = (t: TableWithDerived): Pose => {
    const o = overrides[t.id];
    return o ?? { x: t.x_mm, y: t.y_mm, w: t.w_mm, h: t.h_mm };
  };

  const clampPose = (p: Pose): Pose => {
    const w = Math.min(Math.max(Math.round(p.w), MIN_SIZE), layout.floor.width_mm);
    const h = Math.min(Math.max(Math.round(p.h), MIN_SIZE), layout.floor.height_mm);
    const x = Math.min(Math.max(Math.round(p.x), 0), Math.max(0, layout.floor.width_mm - w));
    const y = Math.min(Math.max(Math.round(p.y), 0), Math.max(0, layout.floor.height_mm - h));
    return { x, y, w, h };
  };

  const beginTableDrag = (
    e: React.PointerEvent,
    table: TableWithDerived,
    mode: "move" | "resize",
    handle?: string
  ) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = poseOf(table);
    dragRef.current = {
      tableId: table.id,
      mode,
      handle,
      startPX: e.clientX,
      startPY: e.clientY,
      startMM: toMm(e.clientX, e.clientY),
      orig: { ...p },
      moved: false,
    };
  };

  const handleCanvasMove = (e: React.PointerEvent) => {
    // Pan (middle mouse or Alt+click), unchanged
    if (isPanning) {
      const dx = ((e.clientX - dragStart.x) * (viewBox.w / 800)) / zoom;
      const dy = ((e.clientY - dragStart.y) * (viewBox.h / 600)) / zoom;
      setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    const session = dragRef.current;
    if (!session) return;
    const table = layout.tables.find((t) => t.id === session.tableId);
    if (!table) return;

    const distPx = Math.hypot(e.clientX - session.startPX, e.clientY - session.startPY);
    if (distPx > CLICK_THRESHOLD_PX && !session.moved) {
      session.moved = true;
      onSelectTable?.(table.id);
    }

    const p = toMm(e.clientX, e.clientY);
    const dx = p.x - session.startMM.x;
    const dy = p.y - session.startMM.y;

    if (session.mode === "move") {
      const next = clampPose({
        ...session.orig,
        x: snap(session.orig.x + dx),
        y: snap(session.orig.y + dy),
      });
      // keep dragged size
      next.w = session.orig.w;
      next.h = session.orig.h;
      setOverrides((prev) => ({ ...prev, [session.tableId]: next }));
      return;
    }

    // Resize in the table's rotated local frame
    const angle = ((table.rotation_deg || 0) * Math.PI) / 180;
    const lx = dx * Math.cos(angle) + dy * Math.sin(angle);
    const ly = -dx * Math.sin(angle) + dy * Math.cos(angle);
    const h = session.handle ?? "se";
    let { x, y, w, h: hh } = session.orig;
    if (h.includes("e")) w = session.orig.w + lx;
    if (h.includes("w")) {
      x = session.orig.x + lx;
      w = session.orig.w - lx;
    }
    if (h.includes("s")) hh = session.orig.h + ly;
    if (h.includes("n")) {
      y = session.orig.y + ly;
      hh = session.orig.h - ly;
    }
    if (table.shape === "round") {
      const dw = h.includes("e") ? lx : h.includes("w") ? -lx : 0;
      const dh = h.includes("s") ? ly : h.includes("n") ? -ly : 0;
      const d = Math.max(session.orig.w + dw, session.orig.h + dh);
      if (h.includes("w")) x = session.orig.x + (session.orig.w - d);
      if (h.includes("n")) y = session.orig.y + (session.orig.h - d);
      w = d;
      hh = d;
    }
    const next = clampPose({ x: snap(x), y: snap(y), w: snap(w), h: snap(hh) });
    setOverrides((prev) => ({ ...prev, [session.tableId]: next }));
  };

  const endTableDrag = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      return;
    }
    const session = dragRef.current;
    dragRef.current = null;
    if (!session) return;
    const table = layout.tables.find((t) => t.id === session.tableId);

    if (!session.moved) {
      // Treat as click → select
      if (session.mode === "move") onSelectTable?.(session.tableId);
      setOverrides((prev) => {
        if (!(session.tableId in prev)) return prev;
        const next = { ...prev };
        delete next[session.tableId];
        return next;
      });
      return;
    }
    if (!table) return;
    const final = clampPose(poseOf({ ...table, ...overrides[session.tableId]! } as TableWithDerived));
    const movedPos = final.x !== table.x_mm || final.y !== table.y_mm;
    const movedSize = final.w !== table.w_mm || final.h !== table.h_mm;
    if (!movedPos && !movedSize) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[session.tableId];
        return next;
      });
      return;
    }
    if (movedSize) {
      resizeMut.mutate({ id: session.tableId, w: final.w, h: final.h });
    }
    if (movedPos) {
      moveMut.mutate({ id: session.tableId, x: final.x, y: final.y });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      // Background click → deselect
      onSelectTable?.(null);
    }
  };

  const statusColors = {
    available: "fill-green-100 stroke-green-500",
    occupied: "fill-red-100 stroke-red-500",
    reserved: "fill-amber-100 stroke-amber-500",
    cleaning: "fill-blue-100 stroke-blue-500",
    out_of_service: "fill-slate-100 stroke-slate-500",
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-zinc-50 dark:bg-zinc-950">
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <Button
          variant={editable ? "default" : "secondary"}
          size="icon-sm"
          onClick={() => setEditable((v) => !v)}
          title={editable ? "Exit edit mode" : "Edit layout"}
        >
          <Icons.edit className="size-4" />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => setZoom((z) => z * 1.2)}>
          <Icons.add className="size-4" />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => setZoom((z) => z / 1.2)}>
          <Icons.chevronDown className="size-4 rotate-180" />
        </Button>
      </div>
      {saving && (
        <div className="absolute left-4 top-4 z-10 rounded-lg bg-background/80 px-2 py-1 text-xs backdrop-blur-sm">
          Saving…
        </div>
      )}

      <svg
        ref={containerRef}
        className={cn(
          "h-full w-full touch-none",
          isPanning ? "cursor-grabbing" : editable ? "cursor-default" : "cursor-default"
        )}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w / zoom} ${viewBox.h / zoom}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handleCanvasMove}
        onPointerUp={endTableDrag}
      >
        <defs>
          <pattern
            id="grid"
            width={layout.floor.grid_size_mm}
            height={layout.floor.grid_size_mm}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${layout.floor.grid_size_mm} 0 L 0 0 0 ${layout.floor.grid_size_mm}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-zinc-200 dark:text-zinc-800"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {layout.tables.map((table) => {
          const isSelected = selectedTableId === table.id;
          const fillClass = statusColors[table.status] || "fill-white stroke-zinc-300";
          const pose = poseOf(table);
          const shapeClass = cn(fillClass, "stroke-2", isSelected && "stroke-primary");

          return (
            <g
              key={table.id}
              transform={`translate(${pose.x},${pose.y}) rotate(${table.rotation_deg},${pose.w / 2},${pose.h / 2})`}
              className={cn(
                "group transition-opacity",
                editable ? "cursor-move" : "cursor-pointer"
              )}
              onPointerDown={(e) => beginTableDrag(e, table, "move")}
              onPointerUp={endTableDrag}
            >
              {renderTableShape(table.shape, pose.w, pose.h, shapeClass)}

              <text
                x={pose.w / 2}
                y={pose.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className="select-none fill-zinc-900 text-[200px] font-bold dark:fill-zinc-100"
              >
                {table.number}
              </text>

              <text
                x={pose.w / 2}
                y={pose.h / 2 + 250}
                textAnchor="middle"
                className="select-none fill-zinc-500 text-[120px] font-medium"
              >
                {table.seated_seats}/{table.capacity}
              </text>

              {editable && isSelected &&
                RESIZE_HANDLES.map((h) => {
                  const hp = handlePosition(h, pose.w, pose.h);
                  return (
                    <rect
                      key={h}
                      x={hp.x - 90}
                      y={hp.y - 90}
                      width={180}
                      height={180}
                      rx={40}
                      className={cn(
                        "fill-background stroke-primary stroke-2",
                        handleCursor(h)
                      )}
                      onPointerDown={(e) => beginTableDrag(e, table, "resize", h)}
                      onPointerUp={endTableDrag}
                    />
                  );
                })}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 p-2 text-xs backdrop-blur-sm">
        {editable
          ? "Drag tables to move • Drag corner/edge bars to resize • Click to select"
          : "Drag with Middle Mouse or Alt+Click to pan. Scroll to zoom."}
      </div>
    </div>
  );
}
