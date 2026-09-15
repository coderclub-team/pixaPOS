/**
 * SQLite worker: real SQLite (wa-sqlite) on the Origin Private File System.
 *
 * Runs in a dedicated module Worker because OPFS access handles are only
 * available off the main thread. Protocol:
 *   in:  { id, type: 'init', ddl: string[] }
 *        { id, type: 'exec', sql, params? }            → { changes, lastId }
 *        { id, type: 'query', sql, params? }           → { columns, rows }
 *   out: { id, ok: true, ... } | { id, ok: false, error }
 *
 * Served from /vendor/wa-sqlite (copied runtime assets, see lib/db/README).
 */
import Module from "/vendor/wa-sqlite/wa-sqlite.mjs";
import { Factory } from "/vendor/wa-sqlite/src/sqlite-api.js";
import { AccessHandlePoolVFS } from "/vendor/wa-sqlite/src/examples/AccessHandlePoolVFS.js";

let sqlite3 = null;
let db = null;

async function init(ddl) {
  if (db) return { tables: "already-open" };
  const module = await Module();
  sqlite3 = Factory(module);
  const vfs = new AccessHandlePoolVFS("/pixa-sqlite");
  await vfs.isReady;
  sqlite3.vfs_register(vfs, false);
  db = await sqlite3.open_v2("pixa.db", 0x00000006 /* READWRITE|CREATE */, "AccessHandlePool");
  for (const statement of ddl) {
    await sqlite3.run(db, statement);
  }
  return { tables: ddl.length };
}

function exec(sql, params) {
  return sqlite3.run(db, sql, params ?? []).then(() => sqlite3.changes(db));
}

function query(sql, params) {
  return sqlite3.execWithParams(db, sql, params ?? []);
}

self.onmessage = async (event) => {
  const { id, type, sql, params, ddl } = event.data ?? {};
  try {
    if (type === "init") {
      const info = await init(ddl ?? []);
      self.postMessage({ id, ok: true, ...info });
    } else if (!db) {
      throw new Error("sqlite worker not initialized");
    } else if (type === "exec") {
      const result = await exec(sql, params);
      self.postMessage({ id, ok: true, changes: result ?? 0 });
    } else if (type === "query") {
      self.postMessage({ id, ok: true, ...query(sql, params) });
    } else {
      throw new Error(`unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
};
