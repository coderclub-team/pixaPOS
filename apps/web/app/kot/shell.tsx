"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@pixa/ui/base-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import { Icons } from "@pixa/ui/icons";
import { UserAvatarProfile } from "@pixa/ui/user-avatar-profile";
import { useIdentity } from "@/hooks/use-identity";
import { getQueryClient } from "@/lib/query-client";
import { tableKeys } from "@/features/table/api/queries";
import { orderKeys } from "@/features/orders/api/queries";
import { floorKeys } from "@/features/floor/api/queries";
import OrderTerminalPage from "@/features/table/components/order-terminal-view";

/**
 * Standalone KOT counter: the full order terminal (floor + bill + payments)
 * without the dashboard shell. Mount on a counter tablet, sign in once.
 * Header mirrors the /kds wallboard: brand, refresh, account chip.
 */
export default function KotShell() {
  const router = useRouter();
  const { user, signOut } = useIdentity();

  const refresh = () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: tableKeys.all });
    qc.invalidateQueries({ queryKey: orderKeys.all });
    qc.invalidateQueries({ queryKey: floorKeys.all });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm">
        <Link href="/dashboard/overview" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="pixaPOS" className="size-full object-cover" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">pixaPOS · KOT</span>
            <span className="block text-[11px] text-muted-foreground">
              Fire tickets, bill and collect
            </span>
          </span>
        </Link>
        <span className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            title="Refresh floor, tables and orders"
          >
            <Icons.refresh className="mr-1 size-4" /> Refresh
          </Button>
          {user && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu" />
                }
              >
                <UserAvatarProfile className="size-7 rounded-full" showInfo user={user} />
                <Icons.chevronsDown className="size-3.5 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/order-terminal")}>
                    <Icons.dashboard className="mr-2 size-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/notifications")}>
                    <Icons.notification className="mr-2 size-4" />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <Icons.logout aria-hidden className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </header>
      <main className="flex-1 overflow-y-auto p-3">
        <OrderTerminalPage hideDescription hideTitle />
      </main>
    </div>
  );
}
