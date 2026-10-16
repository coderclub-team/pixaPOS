/**
 * Client-safe per-outlet sequence for the local (SQLite) mirror.
 * No server imports — safe to bundle into client components.
 */
export async function nextOutletSequenceLocal(
  outletId: string,
  localQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[][] }>,
  localExec: (sql: string, params?: unknown[]) => Promise<unknown>,
): Promise<number> {
  void localExec;
  const { rows } = await localQuery(
    "SELECT COALESCE(MAX(sequence),0) as m FROM events WHERE outlet_id = ?",
    [outletId],
  );
  const maxSeq = Number((rows[0] as unknown[] | undefined)?.[0] ?? 0);
  return maxSeq + 1;
}
