"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { setTablePose } from "../api/service";
import {
  createFloorObject,
  deleteFloorObject,
  setFloorObjectPose,
} from "@/features/floor/api/service";
import { floorLayoutQueryOptions, floorKeys } from "@/features/floor/api/queries";
import { tableKeys } from "../api/queries";
import { cn } from "@pixa/ui/lib/utils";
import { Icons } from "@pixa/ui/icons";
import { Button } from "@pixa/ui/base-ui/button";
import { toast } from "sonner";
import type { TableWithDerived } from "../api/types";
import type { FloorObject } from "@/features/floor/api/types";

export type CanvasMode = "edit" | "operations";

interface FloorPlanCanvasProps {
  floorId: string;
  /** Explicit mode. Edit shows layout tools; operations is select + seat only. */
  mode?: CanvasMode;
  /** @deprecated use mode="edit" instead */
  isEditable?: boolean;
  selectedTableId?: string;
  onSelectTable?: (tableId: string | null) => void;
}

type Pose = { x: number; y: number; w: number; h: number; rotation?: number };
type DragTarget =
  | { kind: "table"; id: string; mode: "move" | "resize" | "rotate"; handle?: string }
  | { kind: "object"; id: string; mode: "move" | "resize" | "rotate"; handle?: string };
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

const statusColors: Record<string, string> = {
  available: "fill-green-100 stroke-green-500",
  occupied: "fill-red-100 stroke-red-500",
  reserved: "fill-amber-100 stroke-amber-500",
  cleaning: "fill-blue-100 stroke-blue-500",
  out_of_service: "fill-slate-100 stroke-slate-500",
};

// H1: memoized nodes — drag pointer events update only the dragged node's pose
const TableNode = memo(function TableNode({
  table,
  pose,
  selected,
  editable,
  onPointerDown,
  onPointerUp,
  onSelect,
  onKeyDown,
}: {
  table: TableWithDerived;
  pose: Pose & { rotation: number };
  selected: boolean;
  editable: boolean;
  onPointerDown: (e: React.PointerEvent, mode: "move" | "resize" | "rotate", handle?: string) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const blocked = !!table.active_block || table.status === "out_of_service";
  const held = !!table.active_hold;
  const fillClass = blocked
    ? "fill-zinc-200 stroke-zinc-500 dark:fill-zinc-800"
    : statusColors[table.status] || "fill-white stroke-zinc-300";
  const shapeClass = cn(fillClass, "stroke-2", selected && "stroke-primary");
  const rot = pose.rotation;
  return (
    <g
      transform={`translate(${pose.x},${pose.y}) rotate(${rot},${pose.w / 2},${pose.h / 2})`}
      className={cn("group transition-opacity", editable ? "cursor-move" : "cursor-pointer")}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onPointerUp={onPointerUp}
      onClick={editable ? undefined : onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Table ${table.number}, ${blocked ? "blocked" : table.status}, ${table.seated_seats} of ${table.capacity} seats`}
      onKeyDown={onKeyDown}
    >
      {renderTableShape(table.shape, pose.w, pose.h, shapeClass)}
      {blocked && (
        <rect width={pose.w} height={pose.h} rx={40} fill="url(#blocked-hatch)" opacity={0.5} />
      )}
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
        {table.seated_seats > 0 && (
          <g>
            {Array.from({ length: Math.min(table.seated_seats, 10) }).map((_, i) => {
              const shown = Math.min(table.seated_seats, 10);
              const gap = 170;
              const startX = pose.w / 2 - ((shown - 1) * gap) / 2;
              return (
                <circle
                  key={i}
                  cx={startX + i * gap}
                  cy={pose.h / 2 + 480}
                  r={65}
                  className="fill-emerald-500 stroke-emerald-700"
                />
              );
            })}
            {table.seated_seats > 10 && (
              <text
                x={pose.w / 2}
                y={pose.h / 2 + 700}
                textAnchor="middle"
                className="select-none fill-zinc-500 text-[110px] font-medium"
              >
                +{table.seated_seats - 10} more
              </text>
            )}
          </g>
        )}
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
      {editable && selected && (
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
                onPointerDown={(e) => onPointerDown(e, "resize", h)}
                onPointerUp={onPointerUp}
              />
            );
          })}
          <g
            transform={`translate(${pose.w / 2},${-420})`}
            className="cursor-grab"
            onPointerDown={(e) => onPointerDown(e, "rotate")}
            onPointerUp={onPointerUp}
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
            <polygon points="55,-70 95,-10 30,-25" className="fill-primary" />
          </g>
        </>
      )}
    </g>
  );
},
// Pose objects are rebuilt per render — compare by value so only the
// dragged node re-renders during pointer moves.
(prev, next) =>
  prev.table === next.table &&
  prev.selected === next.selected &&
  prev.editable === next.editable &&
  prev.pose.x === next.pose.x &&
  prev.pose.y === next.pose.y &&
  prev.pose.w === next.pose.w &&
  prev.pose.h === next.pose.h &&
  prev.pose.rotation === next.pose.rotation
);

const ObjectNode = memo(function ObjectNode({
  obj,
  pose,
  selected,
  editable,
  onPointerDown,
  onPointerUp,
  onSelect,
  onKeyDown,
}: {
  obj: FloorObject;
  pose: Pose & { rotation: number };
  selected: boolean;
  editable: boolean;
  onPointerDown: (e: React.PointerEvent, mode: "move" | "resize" | "rotate", handle?: string) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const objClass = cn(objectFill(obj.kind), "stroke-2", selected && "stroke-primary");
  return (
    <g
      transform={`translate(${pose.x},${pose.y}) rotate(${pose.rotation},${pose.w / 2},${pose.h / 2})`}
      className={cn(editable ? "cursor-move" : "cursor-default")}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onPointerUp={onPointerUp}
      onClick={editable ? undefined : onSelect}
      role="button"
      tabIndex={0}
      aria-label={`${obj.kind}${obj.label ? ` ${obj.label}` : ""}`}
      onKeyDown={onKeyDown}
    >
      {obj.kind === "label" ? (
        <text
          x={pose.w / 2}
          y={pose.h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="select-none fill-zinc-500 text-[160px] font-medium"
        >
          {obj.label ?? "Label"}
        </text>
      ) : (
        renderObjectShape({ ...obj, w_mm: pose.w, h_mm: pose.h }, pose.w, pose.h, objClass)
      )}
      {obj.kind === "label" && selected && (
        <rect
          width={pose.w}
          height={pose.h}
          className="fill-transparent stroke-primary stroke-2 [stroke-dasharray:120_80]"
        />
      )}
      {editable && selected && (
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
                onPointerDown={(e) => onPointerDown(e, "resize", h)}
                onPointerUp={onPointerUp}
              />
            );
          })}
          <g
            transform={`translate(${pose.w / 2},${-420})`}
            className="cursor-grab"
            onPointerDown={(e) => onPointerDown(e, "rotate")}
            onPointerUp={onPointerUp}
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
            <polygon points="55,-70 95,-10 30,-25" className="fill-primary" />
          </g>
        </>
      )}
    </g>
  );
},
(prev, next) =>
  prev.obj === next.obj &&
  prev.selected === next.selected &&
  prev.editable === next.editable &&
  prev.pose.x === next.pose.x &&
  prev.pose.y === next.pose.y &&
  prev.pose.w === next.pose.w &&
  prev.pose.h === next.pose.h &&
  prev.pose.rotation === next.pose.rotation
);

function objectFill(kind: string): string {
  switch (kind) {
    case "wall":
    case "bar":
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

function renderObjectShape(
  o: FloorObject,
  w: number,
  h: number,
  className?: string
) {
  if (o.kind === "label") return null;
  const v = o.shapeVariant;
  if (v === "circle") {
    const d = Math.min(w, h);
    return <circle cx={w / 2} cy={h / 2} r={d / 2} className={className} />;
  }
  if (v === "ellipse") return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} className={className} />;
  if (v === "pill" || o.kind === "separator")
    return <rect width={w} height={h} rx={h / 2} className={className} />;
  return <rect width={w} height={h} rx={40} className={className} />;
}

type PaletteSpec = {
  key: string;
  label: string;
  kind: "wall" | "separator" | "bar" | "decor" | "label";
  shapeVariant?: "rect" | "pill" | "circle" | "ellipse" | "line";
  w: number;
  h: number;
};

const SHAPE_PALETTE: PaletteSpec[] = [
  { key: "wall", label: "Wall", kind: "wall", w: 3000, h: 150 },
  { key: "bar-h", label: "Bar H", kind: "bar", w: 2000, h: 150 },
  { key: "bar-v", label: "Bar V", kind: "bar", w: 150, h: 2000 },
  { key: "separator", label: "Divider", kind: "separator", w: 1200, h: 80 },
  { key: "circle", label: "Circle", kind: "decor", shapeVariant: "circle", w: 800, h: 800 },
  { key: "pill", label: "Pill", kind: "decor", shapeVariant: "pill", w: 1600, h: 400 },
  { key: "label", label: "Label", kind: "label", w: 1200, h: 400 },
];

export default function FloorPlanCanvas({
  floorId,
  mode,
  isEditable,
  selectedTableId,
  onSelectTable,
}: FloorPlanCanvasProps) {
  const queryClient = useQueryClient();
  const { data: layout } = useSuspenseQuery(floorLayoutQueryOptions(floorId));

  // Explicit authoritative mode; legacy isEditable maps to edit/operations.
  const editable = mode !== undefined ? mode === "edit" : (isEditable ?? false);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 12000, h: 8000 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, Pose>>({});
  const [objOverrides, setObjOverrides] = useState<Record<string, Pose & { rotation: number }>>(
    {}
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [addingSpec, setAddingSpec] = useState<PaletteSpec | null>(null);
  const dragRef = useRef<DragSession>(null);
  const rafRef = useRef<number | null>(null);
  // M10: client-side undo stack of inverse pose mutations (cap 50)
  const undoRef = useRef<
    Array<
      | { kind: "table"; id: string; prev: Pose & { rotation: number } }
      | { kind: "object"; id: string; prev: Pose & { rotation: number } }
    >
  >([]);
  const [, setUndoTick] = useState(0);

  const grid = layout.floor.grid_size_mm || 100;
  const snap = (v: number) => Math.round(v / grid) * grid;

  const invalidateLayout = () => {
    queryClient.invalidateQueries({ queryKey: floorKeys.layout(floorId) });
    queryClient.invalidateQueries({ queryKey: tableKeys.all });
  };

  const pushUndo = (
    entry:
      | { kind: "table"; id: string; prev: Pose & { rotation: number } }
      | { kind: "object"; id: string; prev: Pose & { rotation: number } }
  ) => {
    undoRef.current.push(entry);
    if (undoRef.current.length > 50) undoRef.current.shift();
    setUndoTick((t) => t + 1);
  };

  const undoLast = () => {
    const entry = undoRef.current.pop();
    if (!entry) {
      toast.message("Nothing to undo");
      return;
    }
    setUndoTick((t) => t + 1);
    if (entry.kind === "table") {
      setTablePose(entry.id, {
        x_mm: entry.prev.x,
        y_mm: entry.prev.y,
        w_mm: entry.prev.w,
        h_mm: entry.prev.h,
        rotation_deg: entry.prev.rotation,
      }).then(() => invalidateLayout());
    } else {
      setFloorObjectPose(entry.id, {
        x_mm: entry.prev.x,
        y_mm: entry.prev.y,
        w_mm: entry.prev.w,
        h_mm: entry.prev.h,
        rotation_deg: entry.prev.rotation,
      }).then(() => invalidateLayout());
    }
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
      prev: Pose & { rotation: number };
    }) => {
      const { id, prev: _prev, ...pose } = vars;
      return setTablePose(id, pose);
    },
    onSuccess: (_d, vars) => {
      pushUndo({ kind: "table", id: vars.id, prev: vars.prev });
    },
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

  const objPoseMut = useMutation({
    mutationFn: (vars: {
      id: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation_deg?: number;
      prev: Pose & { rotation: number };
    }) => {
      const { id, prev: _prev, ...pose } = vars;
      return setFloorObjectPose(id, pose);
    },
    onSuccess: (_d, vars) => {
      pushUndo({ kind: "object", id: vars.id, prev: vars.prev });
    },
    onError: (e: Error, vars) => {
      setObjOverrides((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      invalidateLayout();
      toast.error(e.message || "Pose conflict — layout refreshed");
    },
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
      spec: PaletteSpec;
      x_mm: number;
      y_mm: number;
    }) =>
      createFloorObject({
        floor_id: floorId,
        kind: vars.spec.kind,
        shapeVariant: vars.spec.shapeVariant,
        label: vars.spec.kind === "label" ? vars.spec.label : undefined,
        x_mm: vars.spec.w ? vars.x_mm : vars.x_mm,
        y_mm: vars.y_mm,
        w_mm: vars.spec.w,
        h_mm: vars.spec.h,
      }),
    onSuccess: (obj) => {
      invalidateLayout();
      setSelectedObjectId(obj.id);
      setAddingSpec(null);
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

  const saving = poseMut.isPending || objPoseMut.isPending;

  const toMm = (clientX: number, clientY: number) => {
    const { s, ox, oy } = viewportMetrics();
    const c = camRef.current;
    return { x: c.x + (clientX - ox) / s, y: c.y + (clientY - oy) / s, s };
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

  const objPoseOf = (o: FloorObject): Pose & { rotation: number } => {
    const ov = objOverrides[o.id];
    return {
      x: ov?.x ?? o.x_mm,
      y: ov?.y ?? o.y_mm,
      w: ov?.w ?? o.w_mm,
      h: ov?.h ?? o.h_mm,
      rotation: ov?.rotation ?? o.rotation_deg,
    };
  };

  // M1: containment uses the rotated bounding box so rotated items
  // cannot overflow the floor or dodge the shrink-orphan guard.
  const clampPose = (p: Pose, rotDeg = 0): Pose => {
    const w = Math.min(Math.max(Math.round(p.w), MIN_SIZE), layout.floor.width_mm);
    const h = Math.min(Math.max(Math.round(p.h), MIN_SIZE), layout.floor.height_mm);
    const r = ((rotDeg || 0) * Math.PI) / 180;
    const boxW = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r));
    const boxH = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
    // Position is top-left pre-rotation; keep the rotated box inside the floor
    // by clamping against the box overhang (conservative, rotation-agnostic).
    const padX = Math.max(0, (boxW - w) / 2);
    const padY = Math.max(0, (boxH - h) / 2);
    const x = Math.min(
      Math.max(Math.round(p.x), -Math.floor(padX)),
      Math.max(-Math.floor(padX), layout.floor.width_mm - w + Math.floor(padX))
    );
    const y = Math.min(
      Math.max(Math.round(p.y), -Math.floor(padY)),
      Math.max(-Math.floor(padY), layout.floor.height_mm - h + Math.floor(padY))
    );
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
        : (() => {
            const p = objPoseOf(obj!);
            return { x: p.x, y: p.y, w: p.w, h: p.h };
          })();
    dragRef.current = {
      target,
      tableId: table?.id,
      startPX: e.clientX,
      startPY: e.clientY,
      startMM: toMm(e.clientX, e.clientY),
      orig,
      origRotation: table?.rotation_deg ?? obj?.rotation_deg ?? 0,
      moved: false,
    };
  };

  // H1: coalesce rapid pointer input through rAF — one state write per frame
  const scheduleFrame = (fn: () => void) => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      fn();
    });
  };

  const cancelDragSession = () => {
    const session = dragRef.current;
    dragRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Revert optimistic previews so nothing ghosts mid-drag
    if (session?.tableId) {
      const id = session.tableId;
      setOverrides((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    if (session?.target.kind === "object") {
      const id = session.target.id;
      setObjOverrides((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setIsPanning(false);
  };

  // Unified camera mirror for stable event-handler reads (H3)
  const camRef = useRef({ x: viewBox.x, y: viewBox.y, zoom });
  camRef.current = { x: viewBox.x, y: viewBox.y, zoom };

  // Letterbox-aware viewport metrics: uniform scale + centered offsets (C4 fix)
  const viewportMetrics = () => {
    const rect = containerRef.current!.getBoundingClientRect();
    const c = camRef.current;
    const effW = viewBox.w / c.zoom;
    const effH = viewBox.h / c.zoom;
    const s = Math.min(rect.width / effW, rect.height / effH);
    return {
      rect,
      s,
      ox: rect.left + (rect.width - effW * s) / 2,
      oy: rect.top + (rect.height - effH * s) / 2,
    };
  };

  // H3: pan scaled by real element size, not hardcoded 800x600
  const handleCanvasMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const cx = e.clientX;
      const cy = e.clientY;
      const sx = dragStart.x;
      const sy = dragStart.y;
      scheduleFrame(() => {
        const { s } = viewportMetrics();
        const dx = (cx - sx) / s;
        const dy = (cy - sy) / s;
        setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
        setDragStart({ x: cx, y: cy });
      });
      return;
    }
    const session = dragRef.current;
    if (!session) return;

    const distPx = Math.hypot(e.clientX - session.startPX, e.clientY - session.startPY);
    if (distPx > CLICK_THRESHOLD_PX && !session.moved) {
      session.moved = true;
    }

    // H1: coalesce pose math + state writes to one rAF per frame
    const cx = e.clientX;
    const cy = e.clientY;
    scheduleFrame(() => {
      const s = dragRef.current;
      if (!s || s !== session) return;
      applyDragFrame(s, cx, cy);
    });
    return;
  };

  const applyDragFrame = (
    session: NonNullable<DragSession>,
    clientX: number,
    clientY: number
  ) => {
    const p = toMm(clientX, clientY);
    const dx = p.x - session.startMM.x;
    const dy = p.y - session.startMM.y;

    if (session.target.kind === "object") {
      const obj = layout.objects.find((o) => o.id === session.target.id);
      if (!obj) return;
      if (session.target.mode === "rotate") {
        const pose = objPoseOf(obj);
        const cx = pose.x + pose.w / 2;
        const cy = pose.y + pose.h / 2;
        const ang = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
        const snapped = Math.round(ang / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG;
        const rotation = ((snapped % 360) + 360) % 360;
        setObjOverrides((prev) => ({
          ...prev,
          [obj.id]: { x: pose.x, y: pose.y, w: pose.w, h: pose.h, rotation },
        }));
        return;
      }
      if (session.target.mode === "resize") {
        const cur = objPoseOf(obj);
        const angle = ((cur.rotation || 0) * Math.PI) / 180;
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
        const next = clampPose(
          { x: snap(x), y: snap(y), w: snap(w), h: snap(hh) },
          cur.rotation
        );
        setObjOverrides((prev) => ({
          ...prev,
          [obj.id]: { ...next, rotation: cur.rotation },
        }));
        return;
      }
      const next = {
        x: snap(Math.min(Math.max(Math.round(session.orig.x + dx), 0), layout.floor.width_mm)),
        y: snap(Math.min(Math.max(Math.round(session.orig.y + dy), 0), layout.floor.height_mm)),
        w: obj.w_mm,
        h: obj.h_mm,
        rotation: obj.rotation_deg,
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
      const next = clampPose(
        {
          ...session.orig,
          x: snap(session.orig.x + dx),
          y: snap(session.orig.y + dy),
        },
        table.rotation_deg
      );
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
    const next = clampPose(
      { x: snap(x), y: snap(y), w: snap(w), h: snap(hh) },
      table.rotation_deg
    );
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
      const ov = objOverrides[session.target.id];
      const final = ov
        ? clampPose({ x: ov.x, y: ov.y, w: ov.w, h: ov.h }, ov.rotation ?? obj.rotation_deg)
        : { x: obj.x_mm, y: obj.y_mm, w: obj.w_mm, h: obj.h_mm };
      const finalRot = ov?.rotation ?? obj.rotation_deg;
      const changed =
        final.x !== obj.x_mm ||
        final.y !== obj.y_mm ||
        final.w !== obj.w_mm ||
        final.h !== obj.h_mm ||
        finalRot !== (obj.rotation_deg || 0);
      if (!changed) {
        setObjOverrides((prev) => {
          const next = { ...prev };
          delete next[session.target.id];
          return next;
        });
        return;
      }
      objPoseMut.mutate({
        id: session.target.id,
        x: final.x,
        y: final.y,
        w: final.w,
        h: final.h,
        rotation_deg: finalRot,
        prev: {
          x: obj.x_mm,
          y: obj.y_mm,
          w: obj.w_mm,
          h: obj.h_mm,
          rotation: obj.rotation_deg,
        },
      });
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
      ? clampPose({ x: ov.x, y: ov.y, w: ov.w, h: ov.h }, ov.rotation ?? table.rotation_deg)
      : { x: table.x_mm, y: table.y_mm, w: table.w_mm, h: table.h_mm };
    const finalRot = ov?.rotation ?? table.rotation_deg;
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
      prev: {
        x: table.x_mm,
        y: table.y_mm,
        w: table.w_mm,
        h: table.h_mm,
        rotation: table.rotation_deg,
      },
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      if (addingSpec) {
        // Click-to-place a new palette object, centered on cursor
        const p = toMm(e.clientX, e.clientY);
        addObjMut.mutate({
          spec: addingSpec,
          x_mm: snap(Math.max(0, Math.round(p.x - addingSpec.w / 2))),
          y_mm: snap(Math.max(0, Math.round(p.y - addingSpec.h / 2))),
        });
        return;
      }
      // Background click → deselect
      onSelectTable?.(null);
      setSelectedObjectId(null);
    }
  };

  // H3: wheel zoom to cursor via non-passive listener (React onWheel is passive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
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
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [floorId]);

  // H7: pointercancel / lost capture / blur cleanup — never leave a stuck drag
  useEffect(() => {
    const onBlur = () => cancelDragSession();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  const zoomCenter = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom((z) => Math.min(Math.max(z * factor, 0.25), 4));
      return;
    }
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const p = toMm(clientX, clientY);
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

  const onTableKeyDown = (e: React.KeyboardEvent, table: TableWithDerived) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectTable?.(table.id);
      return;
    }
    if (e.key === "Escape") {
      onSelectTable?.(null);
      setSelectedObjectId(null);
      return;
    }
    if (!editable) return;
    const step = (e.shiftKey ? 5 : 1) * grid;
    const delta: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const d = delta[e.key];
    if (d) {
      e.preventDefault();
      const p = clampPose({
        x: table.x_mm + d.x,
        y: table.y_mm + d.y,
        w: table.w_mm,
        h: table.h_mm,
      });
      undoRef.current.push({
        kind: "table",
        id: table.id,
        prev: { x: table.x_mm, y: table.y_mm, w: table.w_mm, h: table.h_mm, rotation: table.rotation_deg },
      });
      poseMut.mutate({
        id: table.id,
        x: p.x,
        y: p.y,
        prev: { x: table.x_mm, y: table.y_mm, w: table.w_mm, h: table.h_mm, rotation: table.rotation_deg },
      });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-zinc-50 dark:bg-zinc-950">
      <div className="absolute left-4 top-12 z-10 flex max-w-[220px] flex-wrap gap-1.5 rounded-lg bg-background/80 p-2 backdrop-blur-sm">
        {editable &&
          SHAPE_PALETTE.map((spec) => (
            <Button
              key={spec.key}
              variant={addingSpec?.key === spec.key ? "default" : "secondary"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setAddingSpec((s) => (s?.key === spec.key ? null : spec))}
              title={`Add ${spec.label} (click on canvas to place)`}
            >
              {spec.label}
            </Button>
          ))}
        {!editable && (
          <span className="px-1 text-xs text-muted-foreground">
            Operations — select a table to seat guests
          </span>
        )}
      </div>
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        {editable && (
          <>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={undoLast}
              disabled={undoRef.current.length === 0}
              title="Undo last layout change (Ctrl+Z)"
            >
              <Icons.close className="size-4 -scale-x-100" />
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
        <Button variant="secondary" size="icon-sm" onClick={() => zoomCenter(1.2)} title="Zoom in">
          <Icons.add className="size-4" />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => zoomCenter(1 / 1.2)} title="Zoom out">
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
        onPointerCancel={cancelDragSession}
        onLostPointerCapture={cancelDragSession}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            undoLast();
          }
          if (e.key === "Escape") {
            onSelectTable?.(null);
            setSelectedObjectId(null);
            setAddingSpec(null);
          }
        }}
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

        {/* Floor objects (walls / bars / separators / decor / labels) */}
        {layout.objects.map((o) => (
          <ObjectNode
            key={o.id}
            obj={o}
            pose={objPoseOf(o)}
            selected={selectedObjectId === o.id}
            editable={editable}
            onPointerDown={(e, m, h) =>
              beginDrag(e, { kind: "object", id: o.id, mode: m, handle: h }, undefined, o)
            }
            onPointerUp={endTableDrag}
            onSelect={() => setSelectedObjectId(o.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedObjectId(o.id);
              }
              if (e.key === "Escape") setSelectedObjectId(null);
            }}
          />
        ))}

        {layout.tables.map((table) => (
          <TableNode
            key={table.id}
            table={table}
            pose={poseOf(table)}
            selected={selectedTableId === table.id}
            editable={editable}
            onPointerDown={(e, m, h) =>
              beginDrag(e, { kind: "table", id: table.id, mode: m, handle: h }, table)
            }
            onPointerUp={endTableDrag}
            onSelect={() => onSelectTable?.(table.id)}
            onKeyDown={(e) => onTableKeyDown(e, table)}
          />
        ))}
      </svg>

      <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 p-2 text-xs backdrop-blur-sm">
        {editable
          ? "Drag tables/objects to move • Bars to resize • Top handle to rotate • Click to select"
          : "Scroll to zoom • Drag with Middle Mouse or Alt+Click to pan. Click a table to select."}
      </div>
    </div>
  );
}
