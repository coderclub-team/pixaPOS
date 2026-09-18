import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

type OrgSummary = { id: string; name: string; slug?: string | null; createdAt?: string };
type OrgMember = {
  id: string;
  userId: string;
  role: string;
  user?: { name: string; email: string };
};

/**
 * Typed wrappers around the generated client proxy (its inferred arities are
 * unreliable in this better-auth version — the runtime calls take no data arg
 * for these GET endpoints).
 */
export const baOrgs = {
  list: () =>
    (authClient.organization.list as unknown as () => Promise<{ data: OrgSummary[] | null }>)(),
  getFull: (organizationId: string) =>
    (
      authClient.organization.getFullOrganization as unknown as (args: {
        query: { organizationId: string };
      }) => Promise<{ data: { members?: OrgMember[] } | null }>
    )({ query: { organizationId } }),
  setActive: (organizationId: string) =>
    (
      authClient.organization.setActive as unknown as (args: {
        organizationId: string;
      }) => Promise<unknown>
    )({ organizationId }),
  create: (name: string, slug: string) =>
    (
      authClient.organization.create as unknown as (args: {
        name: string;
        slug: string;
      }) => Promise<{ data: OrgSummary | null; error: { message?: string } | null }>
    )({ name, slug }),
  invite: (organizationId: string, email: string, role: string) =>
    (
      authClient.organization.inviteMember as unknown as (args: {
        organizationId: string;
        email: string;
        role: string;
      }) => Promise<{ error: { message?: string } | null }>
    )({ organizationId, email, role }),
  removeMember: (organizationId: string, memberIdOrEmail: string) =>
    (
      authClient.organization.removeMember as unknown as (args: {
        organizationId: string;
        memberIdOrEmail: string;
      }) => Promise<{ error: { message?: string } | null }>
    )({ organizationId, memberIdOrEmail }),
};
