"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIdentity } from "@/hooks/use-identity";

/**
 * First-run guard: a signed-in user with zero organizations owns an empty
 * sidebar (every operational item requires an org). Send them to Workspaces
 * once so they create their business workspace instead of staring at a blank
 * dashboard. Branches arrive later as outlets — never as new workspaces.
 */
export function useFirstRunRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { loaded, resolved, user, organizations } = useIdentity();

  useEffect(() => {
    if (!loaded || !resolved || !user) return;
    if (organizations.length > 0) return;
    if (pathname === "/dashboard/workspaces") return;
    if (pathname === "/dashboard/profile") return;
    router.replace("/dashboard/workspaces?first=1");
  }, [loaded, resolved, user, organizations, pathname, router]);
}
