"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { updateTable, moveTable, resizeTable, rotateTable } from "../api/service";
import { getFloorLayout } from "@/features/floor/api/service";
import { tableKeys } from "../api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import { cn } from "@pixa/ui/lib/utils";
import { Icons } from "@pixa/ui/icons";
import { Button } from "@pixa/ui/base-ui/button";

interface FloorPlanCanvasProps {
  floorId: string;
  isEditable?: boolean;
  selectedTableId?: string;
  onSelectTable?: (tableId: string | null) => void;
}

export default function FloorPlanCanvas({
  floorId,
  isEditable = false,
  selectedTableId,
  onSelectTable,
}: FloorPlanCanvasProps) {
  const queryClient = useQueryClient();
  const { data: layout } = useSuspenseQuery({
    queryKey: [...floorKeys.all, "layout", floorId],
    queryFn: () => getFloorLayout(floorId),
  });

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 12000, h: 8000 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Panning and Zooming Logic (Hand-rolled SVG per Design Rule 5/7)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = (e.clientX - dragStart.x) * (viewBox.w / 800) / zoom; // simplified
    const dy = (e.clientY - dragStart.y) * (viewBox.h / 600) / zoom;
    setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
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
        <Button variant="secondary" size="icon-sm" onClick={() => setZoom(z => z * 1.2)}>
          <Icons.add className="size-4" />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => setZoom(z => z / 1.2)}>
          <Icons.chevronDown className="size-4 rotate-180" />
        </Button>
      </div>

      <svg
        ref={containerRef}
        className={cn("h-full w-full touch-none", isPanning ? "cursor-grabbing" : "cursor-default")}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w / zoom} ${viewBox.h / zoom}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <pattern id="grid" width={layout.floor.grid_size_mm} height={layout.floor.grid_size_mm} patternUnits="userSpaceOnUse">
            <path d={`M ${layout.floor.grid_size_mm} 0 L 0 0 0 ${layout.floor.grid_size_mm}`} fill="none" stroke="currentColor" strokeWidth="0.5" className="text-zinc-200 dark:text-zinc-800" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {layout.tables.map((table) => {
          const isSelected = selectedTableId === table.id;
          const fillClass = statusColors[table.status] || "fill-white stroke-zinc-300";

          return (
            <g
              key={table.id}
              transform={`translate(${table.x_mm},${table.y_mm}) rotate(${table.rotation_deg},${table.w_mm/2},${table.h_mm/2})`}
              className={cn("group cursor-pointer transition-opacity", isSelected && "opacity-100")}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTable?.(table.id);
              }}
            >
              {table.shape === "round" ? (
                <circle
                  cx={table.w_mm / 2}
                  cy={table.h_mm / 2}
                  r={table.w_mm / 2}
                  className={cn(fillClass, "stroke-2", isSelected && "stroke-primary")}
                />
              ) : (
                <rect
                  width={table.w_mm}
                  height={table.h_mm}
                  rx={table.shape === "square" ? 40 : 80}
                  className={cn(fillClass, "stroke-2", isSelected && "stroke-primary")}
                />
              )}
              
              <text
                x={table.w_mm / 2}
                y={table.h_mm / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className="select-none fill-zinc-900 text-[200px] font-bold dark:fill-zinc-100"
              >
                {table.number}
              </text>

              <text
                x={table.w_mm / 2}
                y={table.h_mm / 2 + 250}
                textAnchor="middle"
                className="select-none fill-zinc-500 text-[120px] font-medium"
              >
                {table.seated_seats}/{table.capacity}
              </text>
            </g>
          );
        })}
      </svg>
      
      {!isEditable && (
        <div className="absolute bottom-4 left-4 rounded-lg bg-background/80 p-2 text-xs backdrop-blur-sm">
          Drag with Middle Mouse or Alt+Click to pan. Scroll to zoom.
        </div>
      )}
    </div>
  );
}
