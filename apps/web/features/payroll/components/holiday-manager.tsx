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
import { createHoliday, deleteHoliday, saveHolidayRule } from "../api/service";
import { holidaysQueryOptions, holidayRuleQueryOptions, payrollKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { HolidayRule } from "../api/types";

export function HolidayManager() {
  const year = new Date().getFullYear();
  const { data: holidays } = useQuery(holidaysQueryOptions(year));
  const { data: rule } = useQuery(holidayRuleQueryOptions);

  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState("");

  const invalidate = () => {
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.holidays() });
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.holidayRule() });
  };

  const addHoliday = useMutation({
    mutationFn: () => createHoliday({ name, date }),
    onSuccess: () => {
      invalidate();
      setName("");
      setDate("");
      toast.success("Holiday added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeHoliday = useMutation({
    mutationFn: (id: string) => deleteHoliday(id),
    onSuccess: () => {
      invalidate();
      toast.success("Holiday removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holidays {year}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Diwali"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-[180px]"
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-[170px]"
            />
            <Button
              size="sm"
              disabled={!name || !date || addHoliday.isPending}
              onClick={() => addHoliday.mutate()}
            >
              Add
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(holidays ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="text-xs">{h.date}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removeHoliday.isPending}
                      onClick={() => removeHoliday.mutate(h.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <HolidayRuleCard rule={rule ?? null} onChange={invalidate} />
    </div>
  );
}

function HolidayRuleCard({ rule, onChange }: { rule: HolidayRule | null; onChange: () => void }) {
  const [multiplier, setMultiplier] = React.useState("1.5");
  const [fixed, setFixed] = React.useState("");
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (rule && !initialized.current) {
      initialized.current = true;
      setMultiplier(String(rule.multiplier));
      setFixed(rule.fixed_incentive_amount ? String(rule.fixed_incentive_amount) : "");
    }
  }, [rule]);

  const save = useMutation({
    mutationFn: () =>
      saveHolidayRule({
        multiplier: Number(multiplier),
        fixed_incentive_amount: fixed ? Number(fixed) : 0,
      }),
    onSuccess: () => {
      onChange();
      toast.success("Rule saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Holiday overtime rule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Extra for holiday work: hours × rate × multiplier + fixed amount.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Multiplier (e.g. 1.5)"
            type="number"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className="max-w-[150px]"
          />
          <Input
            placeholder="Fixed ₹ (optional)"
            type="number"
            value={fixed}
            onChange={(e) => setFixed(e.target.value)}
            className="max-w-[150px]"
          />
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
        {rule && (
          <p className="text-xs text-muted-foreground">
            Current: {rule.multiplier}×
            {rule.fixed_incentive_amount ? ` + ₹${rule.fixed_incentive_amount}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
