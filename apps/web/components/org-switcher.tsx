"use client";

import { Icons } from "@pixa/ui/icons";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@pixa/ui/base-ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@pixa/ui/base-ui/sidebar";
import { useIdentity } from "@/hooks/use-identity";

export function OrgSwitcher() {
  const { isMobile, state } = useSidebar();
  const router = useRouter();
  const { loaded, organization, organizations, membership, setActiveOrg } = useIdentity();

  const orgId = organization?.id;
  const activeOrganization = organization ?? null;

  const handleOrganizationSwitch = async (organizationId: string) => {
    if (orgId === organizationId) {
      return;
    }
    try {
      await setActiveOrg(organizationId);
      router.refresh();
    } catch (error) {
      console.error("Failed to switch organization:", error);
    }
  };

  if (!loaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
              <Icons.galleryVerticalEnd className="size-4" />
            </div>
            <div
              className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                state === "collapsed"
                  ? "invisible max-w-0 overflow-hidden opacity-0"
                  : "visible max-w-full opacity-100"
              }`}
            >
              <span className="truncate font-medium">Loading...</span>
              <span className="text-muted-foreground truncate text-xs">Organizations</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={() => router.push("/dashboard")}
            className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
              <Icons.add className="size-4" />
            </div>
            <div
              className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                state === "collapsed"
                  ? "invisible max-w-0 overflow-hidden opacity-0"
                  : "visible max-w-full opacity-100"
              }`}
            >
              <span className="truncate font-medium">Create organization</span>
              <span className="text-muted-foreground truncate text-xs">Get started</span>
            </div>
            <Icons.chevronsUpDown
              className={`ml-auto transition-all duration-200 ease-in-out ${
                state === "collapsed"
                  ? "invisible max-w-0 opacity-0"
                  : "visible max-w-full opacity-100"
              }`}
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const displayOrganization = activeOrganization || organizations[0];

  if (!displayOrganization) {
    return null;
  }

  return (
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
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
              <Icons.galleryVerticalEnd className="size-4" />
            </div>
            <div
              className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                state === "collapsed"
                  ? "invisible max-w-0 overflow-hidden opacity-0"
                  : "visible max-w-full opacity-100"
              }`}
            >
              <span className="truncate font-medium">{displayOrganization.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {membership?.role || "Organization"}
              </span>
            </div>
            <Icons.chevronsUpDown
              className={`ml-auto transition-all duration-200 ease-in-out ${
                state === "collapsed"
                  ? "invisible max-w-0 opacity-0"
                  : "visible max-w-full opacity-100"
              }`}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Organizations
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              {organizations.map((org, index) => {
                const isActive = org.id === orgId;
                return (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleOrganizationSwitch(org.id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center overflow-hidden rounded-md border">
                      <Icons.galleryVerticalEnd className="size-3.5 shrink-0" />
                    </div>
                    {org.name}
                    {isActive && <Icons.check className="ml-auto size-4" />}
                    {!isActive && <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => {
                  router.push("/dashboard");
                }}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Icons.add className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">Add organization</div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
