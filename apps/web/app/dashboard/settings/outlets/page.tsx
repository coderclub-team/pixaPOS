"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import PageContainer from "@/components/layout/page-container";
import { Button, buttonVariants } from "@pixa/ui/base-ui/button";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";
import { StatusDot } from "@pixa/ui/base-ui/status-dot";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import {
  outletKeys,
  outletsQueryOptions,
  resolveActiveOutlet,
  setActiveOutletId,
} from "@/features/outlet/api/queries";
import { OutletTeamDialog } from "@/features/outlet/components/outlet-team-dialog";
import { getQueryClient } from "@/lib/query-client";

/**
 * Outlets: one organization (singleton per SaaS client) holds many outlets.
 * Each outlet gets its own event sequence, devices, kitchen stations, and
 * tenant-isolated realtime channel. "Use here" switches this terminal
 * (per-browser) to that outlet — realtime, devices, stations and
 * notifications follow. Full editing lives on the outlet detail page.
 */
export default function OutletsPage() {
  const { data: outlets, isPending } = useQuery(outletsQueryOptions);
  const [, setTick] = useState(0);
  const [teamFor, setTeamFor] = useState<string | null>(null);
  const resolved = resolveActiveOutlet(outlets ?? []);

  return (
    <PageContainer
      pageTitle="Outlets"
      pageDescription="One organization, many outlets. Each outlet is an isolated operational boundary with its own orders, devices, and kitchen."
      pageHeaderAction={
        <Link href="/dashboard/settings/outlets/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Icons.add className="mr-1 size-4" /> Add outlet
        </Link>
      }
    >
      {isPending ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading outlets…</p>
      ) : (outlets ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No outlets yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first outlet to start taking orders per location. If you already have one,
              you may be signed in without an organization — check the header account menu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>In use</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(outlets ?? []).map((o) => {
                  const isActive = o.id === resolved;
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{o.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{o.code}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusDot isActive={o.is_active} />
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Icons.check className="size-3.5" /> Here
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <OutletActions
                          outletId={o.id}
                          outletName={o.name}
                          isActive={isActive}
                          canUseHere={o.is_active}
                          onTeam={() => setTeamFor(o.id)}
                          onSwitched={() => setTick((t) => t + 1)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {teamFor && (
        <OutletTeamDialog
          outletId={teamFor}
          outletName={(outlets ?? []).find((o) => o.id === teamFor)?.name ?? teamFor}
          onClose={() => setTeamFor(null)}
        />
      )}
    </PageContainer>
  );
}

function OutletActions({
  outletId,
  outletName,
  isActive,
  canUseHere,
  onTeam,
  onSwitched,
}: {
  outletId: string;
  outletName: string;
  isActive: boolean;
  canUseHere: boolean;
  onTeam: () => void;
  onSwitched: () => void;
}) {
  const router = useRouter();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
        <Icons.ellipsis className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/settings/outlets/${outletId}`)}>
            <Icons.edit className="mr-2 h-4 w-4" /> Profile
          </DropdownMenuItem>
          {!isActive && canUseHere && (
            <DropdownMenuItem
              onClick={() => {
                setActiveOutletId(outletId);
                onSwitched();
                getQueryClient().invalidateQueries({ queryKey: outletKeys.list() });
                toast.success(`Switched this terminal to ${outletName}`);
              }}
            >
              <Icons.check className="mr-2 h-4 w-4" /> Use here
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onTeam}>
            <Icons.user className="mr-2 h-4 w-4" /> Team
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
