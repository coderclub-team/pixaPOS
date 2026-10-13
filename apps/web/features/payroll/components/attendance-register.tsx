"use client";

import * as React from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@pixa/ui/lib/utils";
import {
  attendanceQueryOptions,
  employeesQueryOptions,
  holidaysQueryOptions,
  payrollKeys,
} from "../api/queries";
import { markAttendance } from "../api/service";
import { getQueryClient } from "@/lib/query-client";
import type { AttendanceMark, AttendanceStatus, Employee } from "../api/types";

const CYCLE: AttendanceStatus[] = ["present", "half_day", "absent", "weekly_off", "holiday"];

const STATUS_META: Record<AttendanceStatus, { short: string; label: string; cls: string }> = {
  present: { short: "P", label: "Present", cls: "bg-emerald-100 text-emerald-800" },
  half_day: { short: "H", label: "Half day", cls: "bg-amber-100 text-amber-800" },
  absent: { short: "A", label: "Absent", cls: "bg-red-100 text-red-800" },
  weekly_off: { short: "O", label: "Weekly off", cls: "bg-slate-200 text-slate-600" },
  holiday: { short: "F", label: "Holiday", cls: "bg-sky-100 text-sky-800" },
};

function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  for (let d = 1; ; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) break;
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

function defaultHours(status: AttendanceStatus): number {
  return status === "present" ? 8 : status === "half_day" ? 4 : 0;
}

type Cell = { status: AttendanceStatus; hours: number };

export function AttendanceRegister({
  month,
  onMonthChange,
}: {
  month: string;
  onMonthChange: (m: string) => void;
}) {
  const { data: employees } = useQuery(employeesQueryOptions);
  const { data: saved, isPending } = useQuery(attendanceQueryOptions(month));
  const year = Number(month.slice(0, 4));
  const { data: holidays } = useQuery(holidaysQueryOptions(year));

  const days = React.useMemo(() => daysOfMonth(month), [month]);
  const today = new Date().toISOString().slice(0, 10);

  // Local edits: `${employeeId}:${date}` -> cell. Saved records seed the view.
  const [edits, setEdits] = React.useState<Map<string, Cell>>(new Map());
  const savedMap = React.useMemo(() => {
    const m = new Map<string, Cell>();
    for (const d of saved ?? []) {
      m.set(`${d.employee_id}:${d.date}`, { status: d.status, hours: d.hours });
    }
    return m;
  }, [saved]);

  const cellOf = (empId: string, date: string): Cell | null =>
    edits.get(`${empId}:${date}`) ?? savedMap.get(`${empId}:${date}`) ?? null;

  const dirtyCount = edits.size;
  const invalidate = () => {
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.attendance(month) });
  };

  const save = useMutation({
    mutationFn: () => {
      const rows: AttendanceMark[] = [...edits.entries()].map(([key, cell]) => {
        const [employee_id, date] = key.split(":");
        return { employee_id, date, status: cell.status, hours: cell.hours };
      });
      return markAttendance(rows);
    },
    onSuccess: (r) => {
      setEdits(new Map());
      invalidate();
      toast.success(`Attendance saved (${r.saved} records)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cycle = (emp: Employee, date: string) => {
    if (date > today) return;
    const cur = cellOf(emp.id, date);
    const next = cur ? CYCLE[(CYCLE.indexOf(cur.status) + 1) % CYCLE.length] : "present";
    setEdits((prev) => {
      const nextMap = new Map(prev);
      nextMap.set(`${emp.id}:${date}`, { status: next, hours: defaultHours(next) });
      return nextMap;
    });
  };

  const setHours = (empId: string, date: string, hours: number) => {
    const cur = cellOf(empId, date);
    const status = cur?.status ?? "present";
    setEdits((prev) => {
      const nextMap = new Map(prev);
      nextMap.set(`${empId}:${date}`, { status, hours });
      return nextMap;
    });
  };

  const markAllPresentToday = () => {
    if (!employees) return;
    setEdits((prev) => {
      const nextMap = new Map(prev);
      for (const e of employees.filter((x) => x.status === "active")) {
        if (today.slice(0, 7) !== month) break;
        nextMap.set(`${e.id}:${today}`, { status: "present", hours: 8 });
      }
      return nextMap;
    });
  };

  const autoFillMonth = () => {
    if (!employees) return;
    setEdits((prev) => {
      const nextMap = new Map(prev);
      for (const e of employees.filter((x) => x.status === "active")) {
        for (const d of days) {
          if (d > today) continue;
          const key = `${e.id}:${d}`;
          if (nextMap.has(key) || savedMap.has(key)) continue;
          const sunday = new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
          const status: AttendanceStatus = sunday ? "weekly_off" : "present";
          nextMap.set(key, { status, hours: defaultHours(status) });
        }
      }
      return nextMap;
    });
    toast.success("Month pre-filled (Sundays off) — review, then Save");
  };

  const importHolidays = () => {
    if (!employees || !holidays) return;
    let n = 0;
    setEdits((prev) => {
      const nextMap = new Map(prev);
      for (const h of holidays) {
        const d = h.date.slice(0, 10);
        if (!d.startsWith(month) || d > today) continue;
        for (const e of employees.filter((x) => x.status === "active")) {
          const key = `${e.id}:${d}`;
          if (nextMap.has(key) || savedMap.has(key)) continue;
          nextMap.set(key, { status: "holiday", hours: 0 });
          n++;
        }
      }
      return nextMap;
    });
    toast.success(n > 0 ? `Marked ${n} holiday records` : "No unmarked public holidays this month");
  };

  const active = (employees ?? []).filter((e) => e.status === "active");

  const summary = (empId: string) => {
    let p = 0;
    let h = 0;
    let a = 0;
    let hrs = 0;
    for (const d of days) {
      const c = cellOf(empId, d);
      if (!c) continue;
      if (c.status === "present") p++;
      else if (c.status === "half_day") h++;
      else if (c.status === "absent") a++;
      hrs += c.hours;
    }
    return { p, h, a, hrs };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Register — {month}
          <span className="ml-auto flex flex-wrap gap-2">
            <Input
              type="month"
              value={month}
              onChange={(e) => e.target.value && onMonthChange(e.target.value)}
              className="h-8 w-[150px]"
            />
            <Button size="sm" variant="outline" onClick={markAllPresentToday}>
              Today: all present
            </Button>
            <Button size="sm" variant="outline" onClick={autoFillMonth}>
              Auto-fill month
            </Button>
            <Button size="sm" variant="outline" onClick={importHolidays}>
              Public holidays
            </Button>
            <Button
              size="sm"
              disabled={dirtyCount === 0 || save.isPending}
              onClick={() => save.mutate()}
            >
              Save{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {(Object.keys(STATUS_META) as AttendanceStatus[]).map((s) => (
            <span key={s} className={cn("rounded px-1.5 py-0.5 font-medium", STATUS_META[s].cls)}>
              {STATUS_META[s].short} {STATUS_META[s].label}
            </span>
          ))}
          <span className="ml-auto">
            Tap a day to cycle status · hours editable for hourly staff
          </span>
        </div>
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading register…</p>
        ) : active.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active employees. Add staff under Employees first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 min-w-[150px] bg-card">Employee</TableHead>
                  {days.map((d) => {
                    const dt = new Date(`${d}T00:00:00Z`);
                    const sunday = dt.getUTCDay() === 0;
                    return (
                      <TableHead
                        key={d}
                        className={cn(
                          "min-w-[44px] text-center text-[11px]",
                          sunday && "text-red-500",
                          d === today && "font-bold underline",
                        )}
                      >
                        {["S", "M", "T", "W", "T", "F", "S"][dt.getUTCDay()]}
                        <br />
                        {dt.getUTCDate()}
                      </TableHead>
                    );
                  })}
                  <TableHead className="min-w-[110px] text-right">Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((e) => {
                  const s = summary(e.id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="sticky left-0 bg-card font-medium">
                        <div className="text-sm">{e.name}</div>
                        <div className="text-[11px] text-muted-foreground">{e.pay_type}</div>
                      </TableCell>
                      {days.map((d) => {
                        const c = cellOf(e.id, d);
                        const future = d > today;
                        const meta = c ? STATUS_META[c.status] : null;
                        return (
                          <TableCell key={d} className="p-1 text-center">
                            <button
                              type="button"
                              disabled={future}
                              onClick={() => cycle(e, d)}
                              title={
                                c
                                  ? `${STATUS_META[c.status].label} ${d}${e.pay_type === "hourly" ? ` · ${c.hours}h` : ""}`
                                  : `Unmarked ${d} (counts as present)`
                              }
                              className={cn(
                                "mx-auto flex h-8 w-9 flex-col items-center justify-center rounded text-xs font-semibold",
                                meta ? meta.cls : "border border-dashed text-muted-foreground",
                                future && "opacity-30",
                              )}
                            >
                              {meta ? meta.short : "·"}
                              {e.pay_type === "hourly" && c && (
                                <span className="text-[9px] font-normal">{c.hours}h</span>
                              )}
                            </button>
                            {e.pay_type === "hourly" && c && !future && (
                              <Input
                                type="number"
                                min={0}
                                max={24}
                                value={c.hours}
                                onChange={(ev) =>
                                  setHours(
                                    e.id,
                                    d,
                                    Math.max(0, Math.min(24, Number(ev.target.value) || 0)),
                                  )
                                }
                                className="mx-auto mt-0.5 h-6 w-11 px-1 text-center text-[10px]"
                              />
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-xs">
                        P{s.p} H{s.h} A{s.a}
                        {active.find((x) => x.id === e.id)?.pay_type === "hourly" && (
                          <div className="text-muted-foreground">{s.hrs}h</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
