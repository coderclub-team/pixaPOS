/**
 * Self-managed Better Auth server (Postgres-backed via @pixa/db (Neon),
 * organization plugin with pixaPOS custom roles mapped from config/permissions.ts).
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  db,
  baUser,
  baSession,
  baAccount,
  baVerification,
  baOrganization,
  baMember,
  baInvitation,
} from "@pixa/db";
import { POS_PERMISSIONS, ROLE_PERMISSIONS } from "@/config/permissions";

/** org:resource:action  →  { resource: [action] } for hasPermission checks. */
export function toStatement(permission: string): Record<string, string[]> {
  const parts = permission.split(":");
  const action = parts.pop() ?? "access";
  const resource = parts.slice(1).join("_") || "app";
  return { [resource]: [action] };
}

function statementsFor(roleKey: string): Record<string, string[]> {
  const merged: Record<string, Set<string>> = {};
  for (const perm of ROLE_PERMISSIONS[roleKey] ?? []) {
    const stmt = toStatement(perm);
    for (const [resource, actions] of Object.entries(stmt)) {
      merged[resource] ??= new Set();
      for (const a of actions) merged[resource].add(a);
    }
  }
  return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, [...v]]));
}

// Access-control resources derived from every known permission.
const allStatements = statementsFor("org:admin");
const ac = createAccessControl(allStatements);

const roleKeys = ["admin", "manager", "cashier", "waiter", "kitchen", "accountant"] as const;
const roles = Object.fromEntries(
  roleKeys.map((key) => [key, ac.newRole(statementsFor(`org:${key}`))]),
);

type AuthInstance = ReturnType<typeof betterAuth>;

export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth(), prop, receiver);
  },
  // toNextJsHandler probes `"handler" in auth` — delegate ownership checks too.
  has(_target, prop) {
    return Reflect.has(getAuth(), prop);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getAuth(), prop);
    if (descriptor) descriptor.configurable = true;
    return descriptor;
  },
});

let cached: AuthInstance | null = null;

/** Built on first use — module import (incl. build prerender) never touches the DB. */
function getAuth(): AuthInstance {
  if (!cached) {
    cached = betterAuth({
      baseURL: process.env.BETTER_AUTH_URL,
      database: drizzleAdapter(db(), {
        provider: "pg",
        schema: {
          user: baUser,
          session: baSession,
          account: baAccount,
          verification: baVerification,
          organization: baOrganization,
          member: baMember,
          invitation: baInvitation,
        },
      }),
      emailAndPassword: { enabled: true },
      // Single-app subdomains: every product host below serves this same
      // Next.js app (see lib/hosts.ts). Local + LAN origins included —
      // local.pixapos.store has a real public suffix so origin checks pass
      // where bare .local names are rejected.
      trustedOrigins: [
        "http://localhost:3000",
        "https://localhost:3000",
        "http://localhost:443",
        "https://localhost:443",
        "http://local.pixapos.store:3000",
        "https://local.pixapos.store:3000",
        "https://local.pixapos.store",
        "https://admin.local.pixapos.store",
        "https://app.local.pixapos.store",
        "https://pos.local.pixapos.store",
        "https://kot.local.pixapos.store",
        "https://kds.local.pixapos.store",
        "https://kiosk.local.pixapos.store",
        "https://order.local.pixapos.store",
        "https://shop.local.pixapos.store",
        "https://pixapos.store",
        "https://www.pixapos.store",
        "https://develop.pixapos.store",
        "https://app.develop.pixapos.store",
        "https://admin.develop.pixapos.store",
        "https://pos.develop.pixapos.store",
        "https://captain.develop.pixapos.store",
        "https://kot.develop.pixapos.store",
        "https://kds.develop.pixapos.store",
        "https://kiosk.develop.pixapos.store",
        "https://order.develop.pixapos.store",
        "https://qr.develop.pixapos.store",
        "https://shop.develop.pixapos.store",
        "https://admin.pixapos.store",
        "https://app.pixapos.store",
        "https://pos.pixapos.store",
        "https://kot.pixapos.store",
        "https://kds.pixapos.store",
        "https://kiosk.pixapos.store",
        "https://order.pixapos.store",
        "https://shop.pixapos.store",
      ],
      // Cross-subdomain session: production cookies are scoped to the parent
      // domain so one sign-in works on app/pos/kds/... Default cookie names
      // are kept (changing the prefix would orphan live sessions).
      // Localhost keeps host-only cookies (a domain cookie would break local
      // logins). Never use the hostname as authorization — gates check
      // session + role.
      ...(process.env.COOKIE_DOMAIN
        ? {
            advanced: {
              crossSubDomainCookies: { enabled: true, domain: process.env.COOKIE_DOMAIN },
            },
          }
        : {}),
      // Google is registered only when credentials exist — email/password
      // keeps working in environments without OAuth configured.
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            socialProviders: {
              google: {
                clientId: process.env.GOOGLE_CLIENT_ID as string,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
                // Shared devices (counter tablets): always show the account chooser.
                prompt: "select_account",
              },
            },
          }
        : {}),
      plugins: [
        organization({
          ac,
          roles: roles as never,
          sendInvitationEmail: async () => {
            // No mailer wired yet (fresh-start phase): invitations are created as
            // pending and accepted via invite link by an admin. Wire SMTP here
            // before inviting external staff by email.
          },
        }),
      ],
    }) as unknown as AuthInstance;
  }
  return cached;
}

export type Session = typeof auth.$Infer.Session;

/** All known permission strings (for seeding / validation). */
export function allPermissions(): string[] {
  return Object.values(POS_PERMISSIONS);
}
