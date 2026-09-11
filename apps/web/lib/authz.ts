/**
 * Development-only authorization bypass.
 *
 * When NEXT_PUBLIC_PIXAPOS_DEV_BYPASS is "true" (and we are NOT in a production
 * build), permission/role checks are skipped so developers can see every feature
 * without configuring Clerk custom permissions first.
 *
 * This is inert in production builds and must never be enabled there.
 */
export function hasDevBypass(): boolean {
  return (
    process.env.NEXT_PUBLIC_PIXAPOS_DEV_BYPASS === "true" && process.env.NODE_ENV !== "production"
  );
}

export function can(permissions: string[] | undefined, permission: string): boolean {
  if (hasDevBypass()) return true;
  return (permissions ?? []).includes(permission);
}
