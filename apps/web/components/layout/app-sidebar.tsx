"use client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pixa/ui/base-ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@pixa/ui/base-ui/sidebar";
import { UserAvatarProfile } from "@pixa/ui/user-avatar-profile";
import { navGroups } from "@/config/nav-config";
import { useMediaQuery } from "@pixa/ui/hooks/use-media-query";
import { useIdentity } from "@/hooks/use-identity";
import { useFilteredNavGroups } from "@/hooks/use-nav";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Icons } from "../icons";
import { OrgSwitcher } from "../org-switcher";

export default function AppSidebar() {
  const pathname = usePathname();
  const initialPathnameRef = React.useRef(pathname);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});
  const { isOpen } = useMediaQuery();
  const { user, organization, organizations, loaded, signOut } = useIdentity();
  const router = useRouter();
  const filteredGroups = useFilteredNavGroups(navGroups);
  // Signed in but org-less: every operational item is org-gated, so say so
  // right here instead of rendering a near-empty sidebar.
  const showOrglessCta = loaded && !!user && organizations.length === 0;

  React.useEffect(() => {
    // Side effects based on sidebar state changes
  }, [isOpen]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard/overview" aria-label="pixaPOS home" />}
              tooltip="pixaPOS"
            >
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <Image
                  src="/icon.png"
                  alt="pixaPOS"
                  width={32}
                  height={32}
                  className="size-full object-cover"
                  priority
                />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-bold">pixaPOS</span>
                <span className="truncate text-xs text-muted-foreground">Restaurant OS</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        {showOrglessCta && (
          <SidebarGroup className="py-0">
            <div className="rounded-lg border border-dashed p-3 text-sm">
              <p className="font-medium">No workspace yet</p>
              <p className="pb-2 text-xs text-muted-foreground">
                Create your outlet to unlock sales, menu, inventory and tables.
              </p>
              <Link
                href="/dashboard/workspaces"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                <Icons.add className="size-3.5" /> Create workspace
              </Link>
            </div>
          </SidebarGroup>
        )}
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label || "ungrouped"} className="py-0">
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = (item.icon ? Icons[item.icon] : undefined) ?? Icons.logo;
                const groupKey = `${group.label || "ungrouped"}:${item.title}`;
                const initiallyOpen =
                  item.items?.some(
                    (sub) => sub.url !== "#" && initialPathnameRef.current.startsWith(sub.url),
                  ) ?? false;
                return item?.items && item?.items?.length > 0 ? (
                  <Collapsible
                    key={item.title}
                    // Base UI requires pathname-derived state to be controlled. The
                    // initial route opens its group once; user toggles own the state
                    // for the remainder of this client session.
                    open={expandedGroups[groupKey] ?? initiallyOpen}
                    onOpenChange={(open) =>
                      setExpandedGroups((current) => ({ ...current, [groupKey]: open }))
                    }
                    render={<SidebarMenuItem />}
                  >
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={pathname === item.url}
                          className="group/collapsible"
                        />
                      }
                    >
                      {item.icon && <Icon />}
                      <span>{item.title}</span>
                      <Icons.chevronRight className="ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              render={<Link href={subItem.url} aria-label={subItem.title} />}
                              isActive={pathname === subItem.url}
                            >
                              <span>{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} aria-label={item.title} />}
                      tooltip={item.title}
                      isActive={pathname === item.url}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                {user && <UserAvatarProfile className="h-8 w-8 rounded-lg" showInfo user={user} />}
                <Icons.chevronsDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--anchor-width) min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="px-1 py-1.5">
                      {user && (
                        <UserAvatarProfile className="h-8 w-8 rounded-lg" showInfo user={user} />
                      )}
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  {organization && (
                    <DropdownMenuItem onClick={() => router.push("/dashboard/billing")}>
                      <Icons.creditCard className="mr-2 h-4 w-4" />
                      Billing
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push("/dashboard/notifications")}>
                    <Icons.notification className="mr-2 h-4 w-4" />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <Icons.logout aria-hidden className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
