/**
 * @deprecated Legacy mock utility — all domain services have migrated to Postgres and API routes.
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
