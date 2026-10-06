"use client";

import type { ReactNode } from "react";
import { Input } from "@pixa/ui/base-ui/input";
import { Icons } from "@pixa/ui/icons";

/** Orders-style filter/action bar for admin list pages. */
export function ListToolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

/** Search field matching the dashboard/orders toolbar. */
export function SearchInput({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
}) {
  return (
    <div className="relative max-w-sm flex-1">
      <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="pl-8"
      />
    </div>
  );
}
