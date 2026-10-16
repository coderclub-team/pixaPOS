import type { PixaEvent } from "./types";

/**
 * Provider-agnostic event publisher.
 * Phase 1: PostgresSSEEventPublisher (poll-based SSE tailing events table).
 * Future: AblyEventPublisher etc without changing order/KOT call sites.
 */
export interface EventPublisher {
  publish(event: PixaEvent): Promise<void>;
}

export class NoopEventPublisher implements EventPublisher {
  async publish(_event: PixaEvent): Promise<void> {
    // no-op: events are still queryable via poll
  }
}

export class PostgresSSEEventPublisher implements EventPublisher {
  async publish(_event: PixaEvent): Promise<void> {
    // Phase 1: events table is the source of truth; SSE clients poll it.
    // No additional fanout table needed — publish is a no-op for correctness.
    // Future: INSERT into events_feed or pg_notify here.
  }
}

let singleton: EventPublisher | null = null;

export function getEventPublisher(): EventPublisher {
  if (!singleton) singleton = new PostgresSSEEventPublisher();
  return singleton;
}

export function setEventPublisher(publisher: EventPublisher): void {
  singleton = publisher;
}
