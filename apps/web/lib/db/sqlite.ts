/**
 * SQLite client: dedicated module Worker (OPFS access handles are
 * worker-only) with localStorage read-only fallback when OPFS/Worker is
 * unavailable (private-mode Safari, old browsers).
 *
 * Foundation scope: init + exec/query + schema ensure. Entity repositories
 * and service cutover land in pilot phases — no live behavior changes here.
 */
import { LOCAL_DDL } from "./schema";

export type QueryResult = { columns: string[]; rows: unknown[][] };
export type LocalDbMode = "sqlite" | "fallback" | "unavailable";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let mode: LocalDbMode | null = null;
let initPromise: Promise<LocalDbMode> | null = null;

export function opfsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    !!navigator.storage?.getDirectory
  );
}

function onMessage(event: MessageEvent) {
  const { id, ok, error, ...rest } = event.data ?? {};
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  if (ok) entry.resolve(rest);
  else entry.reject(new Error(error ?? "sqlite worker error"));
}

function call<T>(message: Record<string, unknown>): Promise<T> {
  if (!worker) return Promise.reject(new Error("sqlite worker not started"));
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: any) => void, reject });
    worker!.postMessage({ ...message, id });
  });
}

/** Start the worker, open/create pixa.db on OPFS, ensure schema. */
export function initLocalDb(): Promise<LocalDbMode> {
  if (initPromise) return initPromise;
  initPromise = (async (): Promise<LocalDbMode> => {
    if (!opfsSupported()) {
      mode = "fallback";
      return mode;
    }
    try {
      const probe = await navigator.storage.getDirectory();
      void probe;
      worker = new Worker("/sqlite-worker.js", { type: "module" });
      worker.onmessage = onMessage;
      worker.onerror = (e) => {
        for (const [, entry] of pending) entry.reject(new Error(e.message));
        pending.clear();
      };
      await call<{ tables: number }>({ type: "init", ddl: LOCAL_DDL });
      mode = "sqlite";
      return mode;
    } catch {
      try {
        worker?.terminate();
      } catch {
        /* noop */
      }
      worker = null;
      mode = "fallback";
      return mode;
    }
  })();
  return initPromise;
}

export function localDbMode(): LocalDbMode | null {
  return mode;
}

export async function localExec(sql: string, params: unknown[] = []): Promise<number> {
  const { changes } = await call<{ changes: number }>({ type: "exec", sql, params });
  return changes;
}

export async function localQuery(sql: string, params: unknown[] = []): Promise<QueryResult> {
  return call<QueryResult>({ type: "query", sql, params });
}
