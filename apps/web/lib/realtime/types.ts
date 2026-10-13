import type { BusinessEvent } from "@/features/events/api/types";

export type PixaSource = "POS" | "KDS" | "KIOSK" | "QR" | "CAPTAIN" | "WEBSITE" | "SYSTEM";

export type TerminalType = "POS" | "KDS" | "KIOSK" | "CAPTAIN" | "QR" | "WEBSITE" | "ADMIN";

export type PixaEvent = BusinessEvent & {
  organization_id?: string | null;
  organizationId?: string | null;
  sequence: number;
  source_type?: PixaSource;
  source_device_id?: string | null;
  station_ids?: string[] | null;
  target?: {
    terminalTypes?: TerminalType[];
    stationIds?: string[];
    deviceIds?: string[];
  } | null;
};

export type EventChannel = {
  organizationId: string;
  outletId: string;
};

export function channelKey(ch: EventChannel): string {
  return `org:${ch.organizationId}:outlet:${ch.outletId}`;
}
