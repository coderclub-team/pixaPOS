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
  /** Legacy avatar shape kept for UserAvatarProfile compat. */
  fullName: string;
  emailAddresses: { emailAddress: string }[];
  /** Verified mobile (Better Auth phone-number plugin), when present. */
  phoneNumber?: string | null;
};

type BetterState = {
  user: CompatUser;
  organizations: IdentityOrg[];
  activeOrg: IdentityOrg | null;
  role: string | null;
} | null;

/** Last-known identity for offline continuity (never a credential — the
 * device cookie + server gates still own real auth; this only keeps the UI
 * from blanking when the session endpoint is unreachable). */
const IDENTITY_CACHE_KEY = "pixaIdentity";

type CachedIdentity = {
  user: CompatUser;
  userId: string;
  organizations: IdentityOrg[];
  activeOrg: IdentityOrg | null;
  role: string | null;
  at: string;
};

function readCachedIdentity(): CachedIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIdentity;
    if (!parsed?.user?.emailAddresses?.[0]?.emailAddress) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedIdentity(c: CachedIdentity) {
  try {
    localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(c));
  } catch {}
}

export function clearCachedIdentity() {
  try {
    localStorage.removeItem(IDENTITY_CACHE_KEY);
  } catch {}
}

function toCompatUser(
  name: string,
  email: string,
  image?: string | null,
  phoneNumber?: string | null,
): CompatUser {
  return {
    name,
    email,
    imageUrl: image ?? undefined,
    fullName: name,
    emailAddresses: [{ emailAddress: email }],
    phoneNumber: phoneNumber ?? undefined,
  };
}

/**
 * Identity: Better Auth session with organization + role-derived permissions.
 */
export function useIdentity() {
  const router = useRouter();
  const { data: baSession, isPending: baPending } = ba.useSession();
  const [better, setBetter] = useState<BetterState>(null);
  // Org fetch settles separately from the session — consumers that branch on
  // "zero organizations" (first-run redirect) must wait for this, otherwise
  // users WITH orgs get bounced while the list is still loading.
  const [orgsReady, setOrgsReady] = useState(false);

  useEffect(() => {
    if (!baSession?.user) {
      setBetter(null);
      setOrgsReady(true);
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
      const compat = toCompatUser(
        baSession.user.name,
        baSession.user.email,
        baSession.user.image,
        (baSession.user as { phoneNumber?: string | null }).phoneNumber,
      );
      writeCachedIdentity({
        user: compat,
        userId: baSession.user.id,
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
        at: new Date().toISOString(),
      });
      setBetter({
        user: toCompatUser(
          baSession.user.name,
          baSession.user.email,
          baSession.user.image,
          (baSession.user as { phoneNumber?: string | null }).phoneNumber,
        ),
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
      setOrgsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [baSession?.user?.id, baSession?.session?.activeOrganizationId]);

  // Offline continuity: when the browser is offline and the session
  // endpoint can't answer, serve the last-known identity so nav, role
  // routing and org gates keep working against local data. Online with no
  // session still means signed out (cache is never a bypass).
  const [isOnline, setIsOnline] = useState(
    () => typeof window === "undefined" || window.navigator.onLine,
  );
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const [cached] = useState<CachedIdentity | null>(() =>
    typeof window !== "undefined" ? readCachedIdentity() : null,
  );
  const usingCache = !baSession?.user && !!cached && !baPending && !isOnline;

  const effUser = baSession?.user
    ? (better?.user ??
      toCompatUser(
        baSession.user.name,
        baSession.user.email,
        baSession.user.image,
        (baSession.user as { phoneNumber?: string | null }).phoneNumber,
      ))
    : usingCache
      ? cached!.user
      : null;
  const effOrgs = baSession?.user
    ? (better?.organizations ?? [])
    : usingCache
      ? cached!.organizations
      : [];
  const effOrg = baSession?.user
    ? (better?.activeOrg ?? null)
    : usingCache
      ? cached!.activeOrg
      : null;
  const effRole = baSession?.user ? (better?.role ?? null) : usingCache ? cached!.role : null;

  return {
    source: (baSession?.user ? "better" : null) as IdentitySource,
    loaded: !baPending,
    orgsLoaded: orgsReady || usingCache,
    offlineIdentity: usingCache,
    user: effUser,
    organization: effOrg,
    organizations: effOrgs,
    membership: {
      role: effRole,
      permissions:
        effRole === "owner" || effRole === "org:owner"
          ? Object.values(ROLE_PERMISSIONS).flat()
          : (ROLE_PERMISSIONS[`org:${effRole}`] ??
            (effRole ? (ROLE_PERMISSIONS[effRole] ?? []) : [])),
    } as IdentityMembership,
    setActiveOrg: async (id: string) => {
      await baOrgs.setActive(id);
    },
    signOut: async () => {
      clearCachedIdentity();
      try {
        await ba.signOut({});
      } catch {
        // Offline: session already unreachable — local sign-out still stands.
      }
      router.push("/auth/sign-in");
    },
  };
}
