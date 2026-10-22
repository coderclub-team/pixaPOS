"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIdentity } from "@/hooks/use-identity";

/**
 * Auth callback router (the fork): a signed-in user with zero organizations
 * is new — send them to /onboarding once to create their business workspace,
 * trial record and first outlet, instead of a blank dashboard. Users WITH an
 * organization fall through to wherever they were headed (/dashboard).
 * Branches arrive later as outlets — never as new workspaces.
 *
 * Bounce only on a cleanly-loaded EMPTY list. A failed org fetch (orgsError)
 * means "unknown", never "new user" — bouncing then flashes completed users
 * through /onboarding on every transient failure.
 */
export function useFirstRunRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { loaded, orgsLoaded, orgsError, user, organizations, offlineIdentity } = useIdentity();

  useEffect(() => {
    if (!loaded || !orgsLoaded || !user) return;
    if (orgsError) return;
    // Offline with a cached identity: an empty org list means "unreachable",
    // not "new user" — never bounce to onboarding without network.
    if (offlineIdentity) return;
    if (organizations.length > 0) return;
    if (pathname === "/onboarding") return;
    if (pathname === "/dashboard/profile") return;
    router.replace("/onboarding");
  }, [loaded, orgsLoaded, orgsError, user, organizations, offlineIdentity, pathname, router]);
}
