/**
 * Development-only authorization bypass.
 *
 * Allowed only when APP_ENV is "dev". Stage and prod always enforce real
 * permissions — NODE_ENV alone cannot express the stage tier, so the tier
 * selector is authoritative and env.ts additionally rejects the flag outside
 * dev at boot.
 */
export function hasDevBypass(): boolean {
  return (
    process.env.NEXT_PUBLIC_PIXAPOS_DEV_BYPASS === "true" &&
    (process.env.APP_ENV ?? "dev") === "dev" &&
    process.env.NODE_ENV !== "production"
  );
}

export function can(permissions: string[] | undefined, permission: string): boolean {
  if (hasDevBypass()) return true;
  return (permissions ?? []).includes(permission);
}
