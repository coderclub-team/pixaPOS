"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import { Label } from "@pixa/ui/base-ui/label";
import { Switch } from "@pixa/ui/base-ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { defaultBusinessHours, updateOutlet } from "../api/service";
import { outletKeys } from "../api/queries";
import type { BusinessHours, DayHours, OrderChannelKey } from "../api/types";
import { businessHoursSchema } from "../schemas/outlet";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const CHANNELS: { value: OrderChannelKey; label: string; hint: string }[] = [
  { value: "dine_in", label: "Dine-in", hint: "Tables" },
  { value: "counter", label: "Counter", hint: "Walk-in tokens" },
  { value: "takeaway", label: "Takeaway", hint: "Pickup" },
  { value: "delivery", label: "Delivery", hint: "Courier + aggregators" },
  { value: "own_online", label: "Online", hint: "Own website/app" },
];

function cloneDays(days: DayHours[]): DayHours[] {
  return days.map((d) => ({ ...d }));
}

function WeekGrid({
  days,
  onChange,
  idPrefix,
}: {
  days: DayHours[];
  onChange: (days: DayHours[]) => void;
  idPrefix: string;
}) {
  const set = (day: number, patch: Partial<DayHours>) =>
    onChange(days.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  const copyMonday = () => {
    const mon = days.find((d) => d.day === 1);
    if (!mon) return;
    onChange(
      days.map((d) =>
        d.day === 1 ? d : { ...d, open: mon.open, close: mon.close, closed: mon.closed },
      ),
    );
  };
  return (
    <div className="space-y-1.5">
      {DISPLAY_ORDER.map((day) => {
        const d = days.find((x) => x.day === day)!;
        return (
          <div key={day} className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <span className="w-10 shrink-0 text-sm font-medium">{DAY_NAMES[day]}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Switch
                checked={!d.closed}
                onCheckedChange={(open) => set(day, { closed: !open })}
                aria-label={`${DAY_NAMES[day]} open`}
              />
              <span className="w-14 text-xs text-muted-foreground">
                {d.closed ? "Closed" : "Open"}
              </span>
            </div>
            {!d.closed && (
              <div className="ml-auto flex items-center gap-1.5">
                <Input
                  id={`${idPrefix}-open-${day}`}
                  type="time"
                  value={d.open}
                  onChange={(e) => set(day, { open: e.target.value })}
                  className="h-9 w-28"
                  aria-label={`${DAY_NAMES[day]} opens at`}
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  id={`${idPrefix}-close-${day}`}
                  type="time"
                  value={d.close}
                  onChange={(e) => set(day, { close: e.target.value })}
                  className="h-9 w-28"
                  aria-label={`${DAY_NAMES[day]} closes at`}
                />
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Tip: closing at or before opening spans midnight (e.g. 18:00–02:00).
      </p>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={copyMonday}>
          Copy Monday to all days
        </Button>
      </div>
    </div>
  );
}

export default function BusinessHoursForm({ initialData }: { initialData: BusinessHours }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<DayHours[]>(() => cloneDays(initialData.days));
  const [channels, setChannels] = useState(initialData.channels ?? {});

  const mutation = useMutation({
    mutationFn: (values: BusinessHours) => updateOutlet({ business_hours: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outletKeys.all });
      toast.success("Business hours updated");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update"),
  });

  const setChannelDays = (key: OrderChannelKey, next: DayHours[]) =>
    setChannels((c) => ({
      ...c,
      [key]: { ...(c[key] ?? { use_outlet_hours: false }), days: next },
    }));
  const setInherit = (key: OrderChannelKey, inherit: boolean) =>
    setChannels((c) => ({
      ...c,
      [key]: inherit
        ? { use_outlet_hours: true }
        : { use_outlet_hours: false, days: c[key]?.days ?? cloneDays(days) },
    }));

  const save = async () => {
    const payload: BusinessHours = { days, channels };
    const parsed = businessHoursSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the hours and retry");
      return;
    }
    await mutation.mutateAsync(parsed.data as BusinessHours);
  };

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-left text-xl font-bold">Business Hours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div>
            <p className="font-medium">Outlet hours</p>
            <p className="text-sm text-muted-foreground">
              Base week for the outlet — e.g. 09:00–21:00. Channels inherit this unless overridden
              below.
            </p>
          </div>
          <WeekGrid days={days} onChange={setDays} idPrefix="base" />
        </section>

        {CHANNELS.map((ch) => {
          const conf = channels[ch.value];
          const inherit = conf?.use_outlet_hours ?? true;
          return (
            <section key={ch.value} className="space-y-3 border-t pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {ch.label}{" "}
                    <span className="text-xs font-normal text-muted-foreground">· {ch.hint}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {inherit ? "Same hours as the outlet." : "Custom hours for this channel."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Label htmlFor={`inherit-${ch.value}`} className="text-xs text-muted-foreground">
                    Same as outlet
                  </Label>
                  <Switch
                    id={`inherit-${ch.value}`}
                    checked={inherit}
                    onCheckedChange={(v) => setInherit(ch.value, v)}
                  />
                </div>
              </div>
              {!inherit && (
                <WeekGrid
                  days={conf?.days ?? cloneDays(days)}
                  onChange={(next) => setChannelDays(ch.value, next)}
                  idPrefix={ch.value}
                />
              )}
            </section>
          );
        })}

        <div className="flex justify-end">
          <Button disabled={mutation.isPending} onClick={save} className="min-h-11">
            {mutation.isPending ? "Saving…" : "Save Business Hours"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
