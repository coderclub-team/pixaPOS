# ADR-0003: Floor/Table layout-vs-occupancy split and derived status

Date: 2026-09-10 · Status: accepted

## Context

Restaurant staff need a visual way to manage table occupancy. The previous model used direct `status` writes and lacked spatial information.

## Decisions

1. **Layout ≠ transactional.** `Table` stores identity and pose (x, y, w, h, rotation). Live state is stored in `OccupancyGroup`, `TableBlock`, and `ReservationHold`.
2. **Explicit Table machine.** Statuses are strictly `available | occupied | reserved | cleaning | out_of_service`.
3. **Constrained sharing.** Default is one group per table. Multi-group is an opt-in via `allows_sharing`.
4. **History via Snapshots.** Seating a group captures floor name and table code at that moment.
5. **Dependency-free SVG Canvas.** Interactive 2D map using React and pointer events instead of heavy third-party canvas libraries.

## Consequences

- Durable `CLEANING` state machine tracks clearing progress.
- Business events (`OCCUPANCY_SEATED`, etc.) provide a full audit trail.
- Transition guards prevent deleting floors or tables with active guests.
