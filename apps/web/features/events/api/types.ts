export type EntityType =
  | "FLOOR"
  | "TABLE"
  | "OCCUPANCY_GROUP"
  | "RESERVATION"
  | "ORDER"
  | "KITCHEN_TICKET"
  | "CUSTOMER"
  | "PAYMENT"
  | "STOCK_ITEM"
  | "WASTE_LOG";

export type BusinessEventType =
  | "FLOOR_CREATED"
  | "FLOOR_UPDATED"
  | "FLOOR_DELETED"
  | "FLOOR_REORDERED"
  | "TABLE_CREATED"
  | "TABLE_UPDATED"
  | "TABLE_MOVED"
  | "TABLE_RESIZED"
  | "TABLE_DUPLICATED"
  | "TABLE_DELETED"
  | "TABLE_BLOCKED"
  | "TABLE_UNBLOCKED"
  | "TABLE_CLEANING_STARTED"
  | "TABLE_CLEANING_COMPLETED"
  | "OCCUPANCY_SEATED"
  | "OCCUPANCY_ORDER_ATTACHED"
  | "OCCUPANCY_ORDER_DETACHED"
  | "OCCUPANCY_GUESTS_ADDED"
  | "OCCUPANCY_TRANSFERRED"
  | "OCCUPANCY_RELEASED"
  | "OCCUPANCY_FORCE_RELEASED"
  | "OCCUPANCY_CANCELLED"
  | "ORDER_CREATED"
  | "ORDER_CONFIRMED"
  | "ORDER_SENT_TO_KITCHEN"
  | "ORDER_COMPLETED"
  | "ORDER_CANCELLED"
  | "ITEM_ADDED"
  | "ITEM_MODIFIED"
  | "ITEM_REMOVED"
  | "KITCHEN_TICKET_UPDATED"
  | "KITCHEN_STARTED"
  | "KITCHEN_ITEM_READY"
  | "ORDER_READY"
  | "ORDER_SERVED"
  | "KOT_VOIDED"
  | "KOT_LINE_VOIDED"
  | "KOT_LINE_QTY_ADDED"
  | "PAYMENT_STARTED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "REFUND_CREATED"
  | "ORDER_CUSTOMER_LINKED"
  | "ORDER_DISCOUNTED"
  | "ORDER_SPLIT_BUILT"
  | "ORDER_PAID"
  | "ORDER_LOCKED"
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_DELETED"
  | "WASTE_LOGGED"
  | "WASTE_FROM_ORDER_CANCELLED";

export type BusinessEvent = {
  id: string;
  outlet_id: string;
  entity_type: EntityType;
  entity_id: string;
  event_type: BusinessEventType;
  from_state?: string;
  to_state?: string;
  actor_id?: string; // Clerk user id
  reason_code?: string;
  reason_text?: string;
  metadata?: Record<string, any>;
  created_at: string;
};

export type EventFilters = {
  entity_type?: EntityType;
  entity_id?: string;
  event_type?: BusinessEventType;
  outlet_id?: string;
  date_from?: string;
  date_to?: string;
};
