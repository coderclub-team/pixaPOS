"use client";

import type { ReactNode } from "react";
import { Button } from "@pixa/ui/base-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import { Icons } from "@pixa/ui/icons";

/**
 * Three-dot row action menu matching the dashboard/orders table pattern.
 * Pages compose `DropdownMenuItem`s as children.
 */
export function RowActionsMenu({
  children,
  label = "Actions",
  rowLabel,
}: {
  children: ReactNode;
  label?: string;
  rowLabel?: string;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label={rowLabel ? `Actions for ${rowLabel}` : "Open actions"}
          />
        }
      >
        <Icons.ellipsis className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>{children}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DropdownMenuItem };
