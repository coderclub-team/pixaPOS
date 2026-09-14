import { delay } from "@/constants/mock-api";
import type { BusinessEvent, BusinessEventType, EntityType, EventFilters } from "./types";

const EVENT_STORAGE_KEY = "pixaEvents";

let mockEvents: BusinessEvent[] = [];

function saveEvents() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify({ events: mockEvents }));
    } catch {}
  }
}

function loadEvents(): void {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(EVENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.events)) mockEvents = parsed.events;
      }
    } catch {}
  }
}
loadEvents();

export async function recordEvent(params: {
  outlet_id: string;
  entity_type: EntityType;
  entity_id: string;
  event_type: BusinessEventType;
  from_state?: string;
  to_state?: string;
  actor_id?: string;
  reason_code?: string;
  reason_text?: string;
  metadata?: Record<string, any>;
}): Promise<BusinessEvent> {
  const event: BusinessEvent = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    ...params,
    created_at: new Date().toISOString(),
  };

  mockEvents.push(event);
  saveEvents();
  return { ...event };
}

export async function getEvents(filters?: EventFilters): Promise<BusinessEvent[]> {
  await delay(200);
  loadEvents(); // localStorage is the shared source — reload so tabs/displays agree
  let result = [...mockEvents].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (filters?.outlet_id) {
    result = result.filter((e) => e.outlet_id === filters.outlet_id);
  }
  if (filters?.entity_type) {
    result = result.filter((e) => e.entity_type === filters.entity_type);
  }
  if (filters?.entity_id) {
    result = result.filter((e) => e.entity_id === filters.entity_id);
  }
  if (filters?.event_type) {
    result = result.filter((e) => e.event_type === filters.event_type);
  }
  if (filters?.date_from) {
    result = result.filter((e) => e.created_at >= filters.date_from!);
  }
  if (filters?.date_to) {
    result = result.filter((e) => e.created_at <= filters.date_to!);
  }

  return result;
}
