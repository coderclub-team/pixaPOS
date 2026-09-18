"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, baOrgs } from "@/lib/auth-client";
import { ROLE_PERMISSIONS } from "@/config/permissions";

export type IdentitySource = "better" | null;

export type IdentityOrg = {
  id: string;
  name: string;
  slug?: string | null;
  createdAt?: string | number | Date;
};

export type IdentityMembership = {
  role?: string | null;
  permissions: string[];
};

type BASession = {
  user: { id: string; name: string; email: string; image?: string | null };
  session: { activeOrganizationId?: string };
} | null;

type BAOrganization = { id: string; name: string; slug?: string | null; createdAt?: string };

type BAClient = {
  useSession: () => { data: BASession; isPending: boolean };
  signOut: (opts?: Record<string, unknown>) => Promise<unknown>;
  organization: {
    list: () => Promise<{ data: BAOrganization[] | null }>;
    getFullOrganization: (args: {
      query: { organizationId: string };
    }) => Promise<{ data: { members?: { userId: string; role: string }[] } | null }>;
    setActive: (args: { organizationId: string }) => Promise<unknown>;
  };
};

const ba = authClient as unknown as BAClient;

type CompatUser = {
  name: string;
  email: string;
  imageUrl?: string;
  /** Clerk shape mirror for UserAvatarProfile. */
  fullName: string;
  emailAddresses: { emailAddress: string }[];
};

type BetterState = {
  user: CompatUser;
  organizations: IdentityOrg[];
  activeOrg: IdentityOrg | null;
  role: string | null;
} | null;

function toCompatUser(name: string, email: string, image?: string | null): CompatUser {
  return {
    name,
    email,
    imageUrl: image ?? undefined,
    fullName: name,
    emailAddresses: [{ emailAddress: email }],
  };
}

/**
 * Identity: Better Auth session with organization + role-derived permissions.
 */
export function useIdentity() {
  const router = useRouter();
  const { data: baSession, isPending: baPending } = ba.useSession();
  const [better, setBetter] = useState<BetterState>(null);

  useEffect(() => {
    if (!baSession?.user) {
      setBetter(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const orgs = await baOrgs
        .list()
        .then((r) => r.data ?? [])
        .catch(() => []);
      if (cancelled) return;
      const activeId = baSession.session?.activeOrganizationId;
      let active = orgs.find((o) => o.id === activeId) ?? null;
      // First-run: orgs exist but none active — activate the first so server
      // gates (baHas/baOrgId) agree with the populated sidebar. The overview
      // page additionally redirects org-less users to /dashboard/workspaces.
      if (!active && orgs[0]) {
        try {
          await baOrgs.setActive(orgs[0].id);
        } catch {
          /* session endpoint will retry on next mount */
        }
        if (cancelled) return;
        active = orgs[0];
      }
      active ??= null;
      let role: string | null = null;
      if (active) {
        const full = await baOrgs
          .getFull(active.id)
          .then((r) => r.data)
          .catch(() => null);
        const members = full?.members;
        role = members?.find((m) => m.userId === baSession.user.id)?.role ?? null;
      }
      if (cancelled) return;
      setBetter({
        user: toCompatUser(baSession.user.name, baSession.user.email, baSession.user.image),
        organizations: orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          createdAt: o.createdAt,
        })),
        activeOrg: active
          ? { id: active.id, name: active.name, slug: active.slug, createdAt: active.createdAt }
          : null,
        role,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [baSession?.user?.id, baSession?.session?.activeOrganizationId]);

  return {
    source: (baSession?.user ? "better" : null) as IdentitySource,
    loaded: !baPending,
    user: baSession?.user
      ? (better?.user ?? toCompatUser(baSession.user.name, baSession.user.email))
      : null,
    organization: better?.activeOrg ?? null,
    organizations: better?.organizations ?? [],
    membership: {
      role: better?.role ?? null,
      permissions:
        better?.role === "owner" || better?.role === "org:owner"
          ? Object.values(ROLE_PERMISSIONS).flat()
          : (ROLE_PERMISSIONS[`org:${better?.role}`] ??
            (better?.role ? (ROLE_PERMISSIONS[better.role] ?? []) : [])),
    } as IdentityMembership,
    setActiveOrg: async (id: string) => {
      await baOrgs.setActive(id);
    },
    signOut: async () => {
      await ba.signOut({});
      router.push("/auth/sign-in");
    },
  };
}
