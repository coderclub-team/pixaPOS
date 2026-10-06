/**
 * Instrumentation hook (kept minimal on purpose).
 *
 * A previous revision registered a `process.on("uncaughtException")` guard
 * here to swallow dev-time ECONNRESETs from aborted requests. That broke the
 * Edge Runtime build (proxy.ts compiles for edge, where `process` doesn't
 * exist) and Next flags the call at compile time no matter how it's gated,
 * so the handler was removed. Aborted-request safety now lives in proxy.ts
 * itself (AbortSignal race around the session lookup) using edge-safe APIs.
 */
export async function register() {}
