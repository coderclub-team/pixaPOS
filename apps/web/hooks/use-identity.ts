"use client";

import { useEffect, useState } from "react";
import { useClerk, useOrganization as useClerkOrg, useUser as useClerkUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ROLE_PERMISSIONS } from "@/config/permissions";

export type IdentitySource = "better" | "clerk" | null;

export type IdentityOrg = {
  id: string;
  name: string;
  slug?: string | null;
};

export type IdentityMembership = {
  role?: string | null;
  permissions: string[];
};

type BASession = {
  user: { id: string; name: string; email: string; image?: string | null };
  session: { activeOrganizationId?: string };
} | null;

type BAOrganization = { id: string; name: string; slug?: string | null };

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
 * Strangler identity: prefers a Better Auth session when present, falls back
 * to Clerk. Surfaces swap to this hook once; cutover deletes the Clerk leg.
 */
export function useIdentity() {
  const router = useRouter();
  const { data: baSession, isPending: baPending } = ba.useSession();
  const [better, setBetter] = useState<BetterState>(null);
  const { user: clerkUser } = useClerkUser();
  const { organization: clerkOrg, membership: clerkMembership } = useClerkOrg();
  const { signOut: clerkSignOut } = useClerk();

  useEffect(() => {
    if (!baSession?.user) {
      setBetter(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const orgs = await ba.organization
        .list()
        .then((r) => r.data ?? [])
        .catch(() => []);
      if (cancelled) return;
      const activeId = baSession.session?.activeOrganizationId;
      const active = orgs.find((o) => o.id === activeId) ?? orgs[0] ?? null;
      let role: string | null = null;
      if (active) {
        const full = await ba.organization
          .getFullOrganization({ query: { organizationId: active.id } })
          .then((r) => r.data)
          .catch(() => null);
        const members = full?.members;
        role = members?.find((m) => m.userId === baSession.user.id)?.role ?? null;
      }
      if (cancelled) return;
      setBetter({
        user: toCompatUser(baSession.user.name, baSession.user.email, baSession.user.image),
        organizations: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug })),
        activeOrg: active ? { id: active.id, name: active.name, slug: active.slug } : null,
        role,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [baSession?.user?.id, baSession?.session?.activeOrganizationId]);

  if (baSession?.user) {
    const role = better?.role ?? null;
    const permissions =
      ROLE_PERMISSIONS[`org:${role}`] ?? (role ? (ROLE_PERMISSIONS[role] ?? []) : []);
    return {
      source: "better" as const,
      loaded: !baPending && better !== null,
      user: better?.user ?? toCompatUser(baSession.user.name, baSession.user.email),
      organization: better?.activeOrg ?? null,
      organizations: better?.organizations ?? [],
      membership: { role, permissions } as IdentityMembership,
      setActiveOrg: async (id: string) => {
        await ba.organization.setActive({ organizationId: id });
      },
      signOut: async () => {
        await ba.signOut({});
        router.push("/auth/ba-sign-in");
      },
    };
  }

  return {
    source: (clerkUser ? "clerk" : null) as IdentitySource,
    loaded: true,
    user: clerkUser
      ? {
          name: clerkUser.fullName ?? clerkUser.username ?? "",
          email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
          imageUrl: clerkUser.imageUrl,
          fullName: clerkUser.fullName ?? clerkUser.username ?? "",
          emailAddresses: [{ emailAddress: clerkUser.primaryEmailAddress?.emailAddress ?? "" }],
        }
      : null,
    organization: clerkOrg ? { id: clerkOrg.id, name: clerkOrg.name, slug: clerkOrg.slug } : null,
    organizations: [],
    membership: {
      role: clerkMembership?.role,
      permissions: (clerkMembership?.permissions ?? []) as string[],
    } as IdentityMembership,
    setActiveOrg: async () => {},
    signOut: async () => {
      await clerkSignOut({ redirectUrl: "/auth/sign-in" });
    },
  };
}
