# Local-First POS and KDS

## Product guarantee

Temporary network loss must not force a cashier or kitchen worker to abandon an
order. The future POS/KDS implementation stores approved local commands durably,
shows their sync state, and reconciles them when connectivity returns. This is a
target architecture; the current mock services are not an offline engine.

## Command lifecycle

1. Validate locally against the latest known state and assign an idempotency key.
2. Persist the command and its business event in a durable outbox before showing
   a successful local result.
3. Send in causal order when online. The server accepts an idempotency key once
   and returns the canonical result or a structured conflict.
4. Mark the command `synced`, `retrying`, `blocked`, or `conflicted`; never hide
   a failed financial, inventory, or kitchen action.

## Conflict and recovery policy

Commands must carry entity version or revision data where concurrent writes are
material. The server owns final authorization, payment settlement, inventory
availability, and state-transition decisions. A rejected command stays visible
with an actionable reason and a retry, discard-with-audit, or supervisor-review
path. Never silently overwrite a remote order, KOT line, payment, or stock move.

KDS prioritises visibility: display locally created tickets immediately with a
clear pending indicator, preserve elapsed-time calculation through reconnects,
and reconcile duplicate delivery by ticket/command identity. Printing and device
delivery require their own acknowledged delivery records; UI success alone is not
proof a printer received a job.

## Implementation prerequisites

Introduce durable storage, session/device identity, an outbox processor,
connectivity observation, contract-level idempotency, and operational telemetry
before claiming offline support. Test reconnect, duplicate submission, stale
version, authorization change, device restart, and partial sync scenarios.
