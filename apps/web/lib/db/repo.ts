/**
 * Generic durable mirror: whole-entity JSON documents per collection scope.
 * Services keep their exact in-memory + localStorage hot path and mirror
 * here for eviction-proof durability; the sync processor reads from here.
 * localStorage remains the cross-tab bus (plus a bump ping below).
 *
 * All functions are safe to call fire-and-forget: they never throw, return
 * false on failure, and warn loudly in dev so a broken mirror is visible.
 */
import { initLocalDb, localExec, localQuery } from "./sqlite";

export type DocRow = {
  id: string;
  outlet_id?: string | null;
  data: unknown;
  version?: number;
  updated_at?: string;
  deleted_at?: string | null;
};

const BUMP_KEY = "pixaLocalDbBump";

export function bumpLocalDb(): void {
  try {
    localStorage.setItem(BUMP_KEY, String(Date.now()));
  } catch {}
}

function rowToDoc(row: unknown[]): DocRow {
  const [id, outlet_id, data, version, updated_at, deleted_at] = row as [
    string,
    string | null,
    string,
    number,
    string,
    string | null,
  ];
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(data);
  } catch {
    parsed = null;
  }
  return { id, outlet_id, data: parsed, version, updated_at, deleted_at };
}

/** All docs in a scope (including soft-deleted — callers filter). Empty when unavailable. */
export async function readScope(scope: string): Promise<DocRow[]> {
  try {
    if ((await initLocalDb()) !== "sqlite") return [];
    const { rows } = await localQuery(
      "SELECT id, outlet_id, data, version, updated_at, deleted_at FROM documents WHERE scope = ?",
      [scope],
    );
    return (rows ?? []).map(rowToDoc).filter((d) => d.data != null);
  } catch (e) {
    console.warn(`[repo] readScope(${scope}) failed`, e);
    return [];
  }
}

/**
 * Replace a scope's docs wholesale (mirrors today's full-blob localStorage
 * writes). Upserts first, then deletes missing ids, so a crash mid-write
 * can only leave extras — never lose rows. Returns false on failure.
 */
export async function writeScope(scope: string, rows: DocRow[]): Promise<boolean> {
  try {
    if ((await initLocalDb()) !== "sqlite") return false;
    const now = new Date().toISOString();
    for (const r of rows) {
      await localExec(
        `INSERT INTO documents (scope, id, outlet_id, data, version, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(scope, id) DO UPDATE SET
           outlet_id = excluded.outlet_id, data = excluded.data,
           version = excluded.version, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at`,
        [
          scope,
          r.id,
          r.outlet_id ?? null,
          JSON.stringify(r.data),
          r.version ?? 1,
          r.updated_at ?? now,
          r.deleted_at ?? null,
        ],
      );
    }
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      await localExec(`DELETE FROM documents WHERE scope = ? AND id NOT IN (${placeholders})`, [
        scope,
        ...ids,
      ]);
    } else {
      await localExec("DELETE FROM documents WHERE scope = ?", [scope]);
    }
    bumpLocalDb();
    return true;
  } catch (e) {
    console.warn(`[repo] writeScope(${scope}) failed`, e);
    return false;
  }
}
