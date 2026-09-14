# ADR-0011: Platform boundaries, contract-first APIs, and local-first operations

Date: 2026-09-14 · Status: accepted

## Context

pixaPOS is a Turborepo with a mature web reference app, thin admin/mobile apps,
a shared UI package, and localStorage-backed mock services. Copying web features
into other apps would duplicate domain rules and create divergent UI and APIs.
Restaurant operations also cannot safely treat temporary network loss as a normal
request failure.

## Decisions

1. Apps own route composition; platform code moves only into packages with at
   least two consumers. `@pixa/ui` owns tokens and platform primitives, not domain
   behavior.
2. Future shared business interfaces live in `@pixa/contracts`; transport and
   React Query adapters live in `@pixa/api-client`. Framework, database, and
   hosting choices remain deferred.
3. POS/KDS are local-first targets. Commands require idempotency, durable outbox
   handling, explicit sync/recovery states, and conflict visibility before offline
   support is advertised.
4. The template remains a starter/reference. Copied third-party skill trees are
   not pixaPOS policy and are not maintained as project documentation.

## Consequences

- Existing feature `types.ts/service.ts/queries.ts` boundaries are retained as
  extraction seams.
- New cross-app contracts require compatibility, authorization, transition, and
  idempotency notes plus automated command tests.
- Offline implementation is a platform milestone, not a client-side cache toggle.
