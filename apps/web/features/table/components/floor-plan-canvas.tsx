"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { setTablePose } from "../api/service";
import {
  createFloorObject,
  deleteFloorObject,
  moveFloorObject,
} from "@/features/floor/api/service";
import { floorLayoutQueryOptions, floorKeys } from "@/features/floor/api/queries";
import { tableKeys } from "../api/queries";
import { cn } from "@pixa/ui/lib/utils";
import { Icons } from "@pixa/ui/icons";
import { Button } from "@pixa/ui/base-ui/button";
import { toast } from "sonner";
import type { TableWithDerived } from "../api/types";
import type { FloorObject } from "@/features/floor/api/types";

interface FloorPlanCanvasProps {
  floorId: string;
  isEditable?: boolean;
  selectedTableId?: string;
  onSelectTable?: (tableId: string | null) => void;
}

type Pose = { x: number; y: number; w: number; h: number; rotation?: number };
type DragTarget =
  | { kind: "table"; id: string; mode: "move" | "resize" | "rotate"; handle?: string }
  | { kind: "object"; id: string; mode: "move" };
type DragSession = {
  target: DragTarget;
  tableId?: string;
  startPX: number;
  startPY: number;
  startMM: { x: number; y: number };
  orig: Pose;
  origRotation: number;
  moved: boolean;
} | null;

const MIN_SIZE = 300;
const CLICK_THRESHOLD_PX = 4;
const ROTATE_SNAP_DEG = 15;

function renderTableShape(shape: string, w: number, h: number, className?: string) {
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
        <rect width={w} height={h} rx={shape === "square" ? 40 : 80} className={className} />
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

function objectFill(kind: string): string {
  switch (kind) {
    case "wall":
      return "fill-zinc-400 stroke-zinc-600 dark:fill-zinc-600 dark:stroke-zinc-400";
    case "separator":
      return "fill-amber-200 stroke-amber-500 [stroke-dasharray:120_80]";
    case "label":
      return "fill-transparent stroke-transparent";
    case "decor":
    default:
      return "fill-zinc-100 stroke-zinc-400 [stroke-dasharray:160_100] dark:fill-zinc-800";
  }
}

export default function FloorPlanCanvas({
  floorId,
  isEditable = true,
  selectedTableId,
  onSelectTable,
}: FloorPlanCanvasProps) {
  const queryClient = useQueryClient();
  const { data: layout } = useSuspenseQuery(floorLayoutQueryOptions(floorId));

  const [editable, setEditable] = useState(isEditable);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 12000, h: 8000 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, Pose>>({});
  const [objOverrides, setObjOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [addingKind, setAddingKind] = useState<"wall" | "separator" | "decor" | "label" | null>(
    null
  );
  const dragRef = useRef<DragSession>(null);

  const grid = layout.floor.grid_size_mm || 100;
  const snap = (v: number) => Math.round(v / grid) * grid;

  const invalidateLayout = () => {
    queryClient.invalidateQueries({ queryKey: floorKeys.layout(floorId) });
    queryClient.invalidateQueries({ queryKey: tableKeys.all });
  };

  // H6: single pose mutation — optimistic override, rollback + conflict toast on error
  const poseMut = useMutation({
    mutationFn: (vars: {
      id: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation_deg?: number;
    }) => setTablePose(vars.id, vars),
    onError: (e: Error, vars) => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      invalidateLayout();
      toast.error(e.message || "Pose conflict — layout refreshed");
    },
    onSettled: (_d, _e, vars) => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      invalidateLayout();
    },
  });

  const objMoveMut = useMutation({
    mutationFn: ({ id, x, y }: { id: string; x: number; y: number }) =>
      moveFloorObject(id, { x_mm: x, y_mm: y }),
    onSettled: (_d, _e, vars) => {
      setObjOverrides((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      invalidateLayout();
    },
  });

  const addObjMut = useMutation({
    mutationFn: (vars: {
      kind: "wall" | "separator" | "decor" | "label";
      x_mm: number;
      y_mm: number;
    }) => createFloorObject({ floor_id: floorId, ...vars }),
    onSuccess: (obj) => {
      invalidateLayout();
      setSelectedObjectId(obj.id);
      setAddingKind(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delObjMut = useMutation({
    mutationFn: (id: string) => deleteFloorObject(id),
    onSuccess: () => {
      invalidateLayout();
      setSelectedObjectId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saving = poseMut.isPending || objMoveMut.isPending;

  const toMm = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const effW = viewBox.w / zoom;
    const effH = viewBox.h / zoom;
    return {
      x: viewBox.x + ((clientX - rect.left) * effW) / rect.width,
      y: viewBox.y + ((clientY - rect.top) * effH) / rect.height,
    };
  };

  const poseOf = (t: TableWithDerived): Pose & { rotation: number } => {
    const o = overrides[t.id];
    return {
      x: o?.x ?? t.x_mm,
      y: o?.y ?? t.y_mm,
      w: o?.w ?? t.w_mm,
      h: o?.h ?? t.h_mm,
      rotation: o?.rotation ?? t.rotation_deg,
    };
  };

  const objPosOf = (o: FloorObject) => {
    const ov = objOverrides[o.id];
    return { x: ov?.x ?? o.x_mm, y: ov?.y ?? o.y_mm };
  };

  const clampPose = (p: Pose): Pose => {
    const w = Math.min(Math.max(Math.round(p.w), MIN_SIZE), layout.floor.width_mm);
    const h = Math.min(Math.max(Math.round(p.h), MIN_SIZE), layout.floor.height_mm);
    const x = Math.min(Math.max(Math.round(p.x), 0), Math.max(0, layout.floor.width_mm - w));
    const y = Math.min(Math.max(Math.round(p.y), 0), Math.max(0, layout.floor.height_mm - h));
    return { x, y, w, h };
  };

  const beginDrag = (
    e: React.PointerEvent,
    target: DragTarget,
    table?: TableWithDerived,
    obj?: FloorObject
  ) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const orig: Pose =
      table != null
        ? (() => {
            const p = poseOf(table);
            return { x: p.x, y: p.y, w: p.w, h: p.h };
          })()
        : { x: objPosOf(obj!).x, y: objPosOf(obj!).y, w: obj!.w_mm, h: obj!.h_mm };
    dragRef.current = {
      target,
      tableId: table?.id,
      startPX: e.clientX,
      startPY: e.clientY,
      startMM: toMm(e.clientX, e.clientY),
      orig,
      origRotation: table?.rotation_deg ?? 0,
      moved: false,
    };
  };

  // H3: pan scaled by real element size, not hardcoded 800x600
  const handleCanvasMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const rect = containerRef.current!.getBoundingClientRect();
      const effW = viewBox.w / zoom;
      const effH = viewBox.h / zoom;
      const dx = ((e.clientX - dragStart.x) * effW) / rect.width;
      const dy = ((e.clientY - dragStart.y) * effH) / rect.height;
      setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    const session = dragRef.current;
    if (!session) return;

    const distPx = Math.hypot(e.clientX - session.startPX, e.clientY - session.startPY);
    if (distPx > CLICK_THRESHOLD_PX && !session.moved) {
      session.moved = true;
    }

    const p = toMm(e.clientX, e.clientY);
    const dx = p.x - session.startMM.x;
    const dy = p.y - session.startMM.y;

    if (session.target.kind === "object") {
      const obj = layout.objects.find((o) => o.id === session.target.id);
      if (!obj) return;
      const next = {
        x: snap(Math.min(Math.max(Math.round(session.orig.x + dx), 0), layout.floor.width_mm)),
        y: snap(Math.min(Math.max(Math.round(session.orig.y + dy), 0), layout.floor.height_mm)),
      };
      setObjOverrides((prev) => ({ ...prev, [session.target.id]: next }));
      return;
    }

    const table = layout.tables.find((t) => t.id === session.tableId);
    if (!table) return;

    if (session.target.mode === "rotate") {
      const pose = poseOf(table);
      const cx = pose.x + pose.w / 2;
      const cy = pose.y + pose.h / 2;
      const ang = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      const snapped = Math.round(ang / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG;
      const rotation = ((snapped % 360) + 360) % 360;
      setOverrides((prev) => ({ ...prev, [table.id]: { ...session.orig, rotation } }));
      return;
    }

    if (session.target.mode === "move") {
      const next = clampPose({
        ...session.orig,
        x: snap(session.orig.x + dx),
        y: snap(session.orig.y + dy),
      });
      next.w = session.orig.w;
      next.h = session.orig.h;
      setOverrides((prev) => ({ ...prev, [session.tableId!]: next }));
      return;
    }

    // Resize in the table's rotated local frame
    const angle = ((table.rotation_deg || 0) * Math.PI) / 180;
    const lx = dx * Math.cos(angle) + dy * Math.sin(angle);
    const ly = -dx * Math.sin(angle) + dy * Math.cos(angle);
    const h = session.target.handle ?? "se";
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
    setOverrides((prev) => ({ ...prev, [session.tableId!]: next }));
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

    if (session.target.kind === "object") {
      const obj = layout.objects.find((o) => o.id === session.target.id);
      if (!session.moved || !obj) {
        if (!session.moved) setSelectedObjectId(session.target.id);
        setObjOverrides((prev) => {
          if (!(session.target.id in prev)) return prev;
          const next = { ...prev };
          delete next[session.target.id];
          return next;
        });
        return;
      }
      const ov = objOverrides[session.target.id] ?? { x: obj.x_mm, y: obj.y_mm };
      if (ov.x === obj.x_mm && ov.y === obj.y_mm) {
        setObjOverrides((prev) => {
          const next = { ...prev };
          delete next[session.target.id];
          return next;
        });
        return;
      }
      objMoveMut.mutate({ id: session.target.id, x: ov.x, y: ov.y });
      return;
    }

    const table = layout.tables.find((t) => t.id === session.tableId);
    if (!session.moved) {
      // Treat as click → select
      if (session.target.mode === "move") onSelectTable?.(session.tableId!);
      setOverrides((prev) => {
        if (!(session.tableId! in prev)) return prev;
        const next = { ...prev };
        delete next[session.tableId!];
        return next;
      });
      return;
    }
    if (!table) return;
    const ov = overrides[session.tableId!];
    const finalPose = ov
      ? clampPose({ x: ov.x, y: ov.y, w: ov.w, h: ov.h })
      : { x: table.x_mm, y: table.y_mm, w: table.w_mm, h: table.h_mm };
    const finalRot =
      ov?.rotation ?? table.rotation_deg;
    const movedPos = finalPose.x !== table.x_mm || finalPose.y !== table.y_mm;
    const movedSize = finalPose.w !== table.w_mm || finalPose.h !== table.h_mm;
    const movedRot = finalRot !== (table.rotation_deg || 0);
    if (!movedPos && !movedSize && !movedRot) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[session.tableId!];
        return next;
      });
      return;
    }
    // H6: one pose mutation per pointer-up (optimistic override stays until settled)
    poseMut.mutate({
      id: session.tableId!,
      ...(movedPos ? { x: finalPose.x, y: finalPose.y } : {}),
      ...(movedSize ? { w: finalPose.w, h: finalPose.h } : {}),
      ...(movedRot ? { rotation_deg: finalRot } : {}),
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      if (addingKind) {
        // Click-to-place a new wall/separator/decor/label
        const p = toMm(e.clientX, e.clientY);
        addObjMut.mutate({
          kind: addingKind,
          x_mm: snap(Math.max(0, Math.round(p.x - 1000))),
          y_mm: snap(Math.max(0, Math.round(p.y - 75))),
        });
        return;
      }
      // Background click → deselect
      onSelectTable?.(null);
      setSelectedObjectId(null);
    }
  };

  // H3: wheel zoom to cursor
  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const p = toMm(e.clientX, e.clientY);
    setZoom((z) => {
      const nz = Math.min(Math.max(z * factor, 0.25), 4);
      const f = nz / z;
      setViewBox((prev) => ({
        ...prev,
        x: p.x - (p.x - prev.x) / f,
        y: p.y - (p.y - prev.y) / f,
      }));
      return nz;
    });
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
        {editable && (
          <>
            <Button
              variant={addingKind === "wall" ? "default" : "secondary"}
              size="icon-sm"
              onClick={() => setAddingKind((k) => (k === "wall" ? null : "wall"))}
              title="Add wall (click on canvas to place)"
            >
              <Icons.add className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => selectedObjectId && delObjMut.mutate(selectedObjectId)}
              disabled={!selectedObjectId}
              title="Delete selected object"
            >
              <Icons.trash className="size-4" />
            </Button>
          </>
        )}
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
        className={cn("h-full w-full touch-none", isPanning ? "cursor-grabbing" : "cursor-default")}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w / zoom} ${viewBox.h / zoom}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handleCanvasMove}
        onPointerUp={endTableDrag}
        onWheel={handleWheel}
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
          <pattern
            id="blocked-hatch"
            width={240}
            height={240}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={240} height={240} fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="240" stroke="currentColor" strokeWidth={60} className="text-zinc-400" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Floor objects (walls / separators / decor / labels) */}
        {layout.objects.map((o) => {
          const pos = objPosOf(o);
          const isSel = selectedObjectId === o.id;
          return (
            <g
              key={o.id}
              transform={`translate(${pos.x},${pos.y}) rotate(${o.rotation_deg},${o.w_mm / 2},${o.h_mm / 2})`}
              className={cn(editable ? "cursor-move" : "cursor-default")}
              onPointerDown={(e) =>
                beginDrag(e, { kind: "object", id: o.id, mode: "move" }, undefined, o)
              }
              onPointerUp={endTableDrag}
            >
              {o.kind === "label" ? (
                <text
                  x={o.w_mm / 2}
                  y={o.h_mm / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="select-none fill-zinc-500 text-[160px] font-medium"
                >
                  {o.label ?? "Label"}
                </text>
              ) : (
                <rect
                  width={o.w_mm}
                  height={o.h_mm}
                  rx={o.kind === "separator" ? o.h_mm / 2 : 40}
                  className={cn(objectFill(o.kind), "stroke-2", isSel && "stroke-primary")}
                  style={o.color ? { fill: o.color } : undefined}
                />
              )}
              {o.kind === "label" && isSel && (
                <rect
                  width={o.w_mm}
                  height={o.h_mm}
                  className="fill-transparent stroke-primary stroke-2 [stroke-dasharray:120_80]"
                />
              )}
            </g>
          );
        })}

        {layout.tables.map((table) => {
          const isSelected = selectedTableId === table.id;
          // M2: render from derived state — blocked tables get hatch, holds get a badge
          const blocked = !!table.active_block || table.status === "out_of_service";
          const held = !!table.active_hold;
          const fillClass = blocked
            ? "fill-zinc-200 stroke-zinc-500 dark:fill-zinc-800"
            : statusColors[table.status] || "fill-white stroke-zinc-300";
          const pose = poseOf(table);
          const shapeClass = cn(fillClass, "stroke-2", isSelected && "stroke-primary");
          const rot = pose.rotation;

          return (
            <g
              key={table.id}
              transform={`translate(${pose.x},${pose.y}) rotate(${rot},${pose.w / 2},${pose.h / 2})`}
              className={cn("group transition-opacity", editable ? "cursor-move" : "cursor-pointer")}
              onPointerDown={(e) => beginDrag(e, { kind: "table", id: table.id, mode: "move" }, table)}
              onPointerUp={endTableDrag}
            >
              {renderTableShape(table.shape, pose.w, pose.h, shapeClass)}
              {blocked && (
                <rect width={pose.w} height={pose.h} rx={40} fill="url(#blocked-hatch)" opacity={0.5} />
              )}

              {/* H8: counter-rotated labels stay upright */}
              <g transform={`rotate(${-rot},${pose.w / 2},${pose.h / 2})`}>
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

                {held && (
                  <g transform={`translate(${pose.w - 220},${-60})`}>
                    <circle r={110} className="fill-amber-400 stroke-amber-600" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="select-none fill-white text-[140px] font-bold"
                    >
                      R
                    </text>
                  </g>
                )}
              </g>

              {editable && isSelected && (
                <>
                  {RESIZE_HANDLES.map((h) => {
                    const hp = handlePosition(h, pose.w, pose.h);
                    return (
                      <rect
                        key={h}
                        x={hp.x - 90}
                        y={hp.y - 90}
                        width={180}
                        height={180}
                        rx={40}
                        className={cn("fill-background stroke-primary stroke-2", handleCursor(h))}
                        onPointerDown={(e) =>
                          beginDrag(e, { kind: "table", id: table.id, mode: "resize", handle: h }, table)
                        }
                        onPointerUp={endTableDrag}
                      />
                    );
                  })}
                  {/* H8: rotate handle above the table */}
                  <g
                    transform={`translate(${pose.w / 2},${-420})`}
                    className="cursor-grab"
                    onPointerDown={(e) =>
                      beginDrag(e, { kind: "table", id: table.id, mode: "rotate" }, table)
                    }
                    onPointerUp={endTableDrag}
                  >
                    <circle r={130} className="fill-background stroke-primary stroke-2" />
                    <path
                      d="M -55 20 A 60 60 0 1 1 55 -20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={36}
                      className="text-primary"
                      strokeLinecap="round"
                    />
                    <polygon
                      points="55,-70 95,-10 30,-25"
                      className="fill-primary"
                    />
                  </g>
                </>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 p-2 text-xs backdrop-blur-sm">
        {editable
          ? "Drag tables/objects to move • Bars to resize • Top handle to rotate • Click to select"
          : "Scroll or pinch to zoom • Drag with Middle Mouse or Alt+Click to pan."}
      </div>
    </div>
  );
}
