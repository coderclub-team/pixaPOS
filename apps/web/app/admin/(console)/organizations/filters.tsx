"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import { Input } from "@pixa/ui/base-ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pixa/ui/base-ui/select";
import { Icons } from "@pixa/ui/icons";

const LIFECYCLES = ["trial", "active", "past_due", "suspended", "churned"];

export function OrgFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [lifecycle, setLifecycle] = useState(searchParams.get("lifecycle") ?? "all");

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (lifecycle !== "all") params.set("lifecycle", lifecycle);
    const qs = params.toString();
    router.push(`/admin/organizations${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap gap-2 rounded-xl border bg-card p-3"
      role="search"
      aria-label="Filter organisations"
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or slug…"
        aria-label="Search name or slug"
        className="min-w-52 flex-1"
      />
      <Select value={lifecycle} onValueChange={setLifecycle}>
        <SelectTrigger className="w-44" aria-label="Lifecycle">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All lifecycles</SelectItem>
          {LIFECYCLES.map((l) => (
            <SelectItem key={l} value={l} className="capitalize">
              {l.replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" variant="outline">
        <Icons.search className="size-3.5" aria-hidden />
        Filter
      </Button>
    </form>
  );
}

export function ReviewRegistrationsButton() {
  return (
    <Button nativeButton={false} render={<Link href="/admin/leads" />}>
      Review registrations
      <Icons.arrowRight className="size-3.5" aria-hidden />
    </Button>
  );
}
