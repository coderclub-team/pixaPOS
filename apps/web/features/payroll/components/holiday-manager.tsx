"use client";

import * as React from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
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
import { createHoliday, createHolidayRule, deleteHolidayRule } from "../api/service";
import { holidaysQueryOptions, holidayRulesQueryOptions, payrollKeys } from "../api/queries";
import { getQueryClient } from "@/lib/query-client";
import type { HolidayPayRule } from "../api/types";

export function HolidayManager() {
  const year = new Date().getFullYear();
  const { data: holidays } = useQuery(holidaysQueryOptions(year));
  const { data: rules } = useQuery(holidayRulesQueryOptions);

  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState("");

  const invalidate = () => {
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.holidays() });
    getQueryClient().invalidateQueries({ queryKey: payrollKeys.holidayRules() });
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(holidays ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="text-xs">{h.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <HolidayRuleCard rules={rules ?? []} onChange={invalidate} />
    </div>
  );
}

function HolidayRuleCard({ rules, onChange }: { rules: HolidayPayRule[]; onChange: () => void }) {
  const [payType, setPayType] = React.useState("hourly");
  const [multiplier, setMultiplier] = React.useState("1.5");
  const [fixed, setFixed] = React.useState("");

  const add = useMutation({
    mutationFn: () =>
      createHolidayRule({
        pay_type: payType,
        multiplier: Number(multiplier),
        fixed_amount: fixed ? Number(fixed) : 0,
      }),
    onSuccess: () => {
      onChange();
      toast.success("Rule saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteHolidayRule(id),
    onSuccess: () => {
      onChange();
      toast.success("Rule removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Holiday pay rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Overtime for hours worked on a holiday: extra = hours × rate × multiplier + fixed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Select value={payType} onValueChange={setPayType}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="salary">Salary</SelectItem>
            </SelectContent>
          </Select>
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
          <Button size="sm" disabled={add.isPending} onClick={() => add.mutate()}>
            Save
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applies to</TableHead>
              <TableHead>Multiplier</TableHead>
              <TableHead>Fixed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.pay_type}</TableCell>
                <TableCell>{r.multiplier}×</TableCell>
                <TableCell>₹{r.fixed_amount}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(r.id)}
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
  );
}
