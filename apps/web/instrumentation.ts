/**
 * Dev-only safety net: Next's dev server turns an aborted client request
 * (reload / navigation while proxy.ts awaits a cold session lookup) into an
 * uncaught ECONNRESET that kills the whole server. Swallow ONLY abort-type
 * errors in development so one cancelled request can't take down `dev:web`.
 * Production crash reporting stays untouched — real bugs still throw.
 */
export async function register() {
  if (process.env.NODE_ENV !== "development") return;
  if ((globalThis as { __pixaAbortGuard?: boolean }).__pixaAbortGuard) return;
  (globalThis as { __pixaAbortGuard?: boolean }).__pixaAbortGuard = true;

  process.on("uncaughtException", (err: unknown) => {
    const code = (err as { code?: string } | null)?.code;
    const message = err instanceof Error ? err.message : String(err);
    const isAbort =
      code === "ECONNRESET" || /aborted/i.test(message) || /ECONNRESET/i.test(message);
    if (isAbort) {
      console.warn(`[dev] ignored aborted-request crash: ${code ?? message}`);
      return;
    }
    throw err;
  });
}
