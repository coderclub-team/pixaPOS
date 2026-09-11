# ADR-0004: Floor-plan editor vs operations split and canvas performance

Date: 2026-09-11 · Status: accepted

## Context

The floor-plan canvas grew two conflicting jobs: a layout editor (drag/resize/rotate
tables, place floor objects) and the daily operations view (tap a table, seat guests).
One route served both, drag handlers ran in ops mode, and every pointer move re-rendered
the whole SVG tree — laggy on large floors and confusing for floor staff.

## Decisions

1. **Explicit mode, not a boolean.** `FloorPlanCanvas` takes `mode: "edit" | "operations"`.
   Legacy `isEditable` is deprecated and maps to the same two modes. Drag, resize,
   rotate, arrow-key nudging, the shape palette, and undo exist only in `edit` mode;
   `operations` is select-only with an inline hint ("Operations — select a table").
2. **Route + nav split.** `/dashboard/tables` (sidebar "Tables") is the operations view
   for daily seating. The settings route keeps the same component in `mode="edit"` and
   shows an amber "Layout editor — not for daily seating" badge. Settings nav entry is
   renamed "Floor Plan Editor".
3. **Drag performance.** Table/object nodes are `memo()`-ized on `(pose, selected,
   editable)` so pointer-move only re-renders the dragged node; the move commit writes
   through the existing version-CAS `setTablePose`/`setFloorObjectPose` path, with an
   undo stack entry per committed move.
4. **Single table-identity source.** Canvas labels and the detail panel both resolve the
   real table entity (`tableQueryOptions`) and render `table.number` — never ID fragments.
   Chair chips are capped at 24 with a "+n more" summary for large communal tables.
5. **Floor-change clears selection.** Switching floor tabs resets `selectedTableId` so the
   detail panel can never show a table from another floor.
6. **Edit-mode inspector.** The side panel in edit mode shows identity + pose read-only
   with a link to the table form, plus an "Add table" command that creates a default
   4-seat table on the current floor for drag placement. Detail-panel seat/release/
   transfer/block/mark-cleaned flows live only in operations mode.

## Consequences

- Ops staff cannot accidentally move tables; layout tools cannot be reached by accident.
- Canvas stays allocation-free during drags except for the active node.
- Automated transition tests are deferred: the repo has no test runner and the registry
  is unreachable from this environment. Transitions are covered by the explicit
  `canTransition` map + `transitionTable` choke point (ADR-0003) and verified via
  `tsc --noEmit` + production build.
