"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Order types the /kot header picker offers. Aggregator/online sources stay
 * a back-office concern — the counter only needs fulfillment types. */
export const kotOrderTypeOptions = [
  { label: "Dine-in", value: "dine_in" },
  { label: "Counter", value: "counter" },
  { label: "Takeaway", value: "takeaway" },
  { label: "Delivery", value: "delivery" },
] as const;

export type KotOrderType = (typeof kotOrderTypeOptions)[number]["value"];

/** Temporary outlet identity until /kot knows its real outlet (service still
 * falls back to out_001). TODO: replace with the selected outlet's type. */
export const KOT_DEFAULT_OUTLET_TYPE = "restaurant";

/** Default order type per outlet type: table-first houses open on the floor,
 * counter-first houses open on the menu. */
export function defaultOrderTypeForOutlet(outletType: string): KotOrderType {
  switch (outletType) {
    case "restaurant":
    case "fine_dine":
      return "dine_in";
    case "qsr":
    case "cloud_kitchen":
    case "cafe":
    case "bakery":
    default:
      return "counter";
  }
}

type OrderTypeSelection = {
  orderType: KotOrderType;
  setOrderType: (t: KotOrderType) => void;
  isDineIn: boolean;
};

const OrderTypeContext = createContext<OrderTypeSelection | null>(null);

/** Provided by the /kot shell only — elsewhere (dashboard terminal) there is
 * no picker and consumers fall back to dine-in. */
export function OrderTypeProvider({ children }: { children: ReactNode }) {
  const [orderType, setOrderType] = useState<KotOrderType>(() =>
    defaultOrderTypeForOutlet(KOT_DEFAULT_OUTLET_TYPE),
  );
  return (
    <OrderTypeContext.Provider
      value={{ orderType, setOrderType, isDineIn: orderType === "dine_in" }}
    >
      {children}
    </OrderTypeContext.Provider>
  );
}

/** Null outside the /kot shell provider — callers must default to dine-in. */
export function useOrderType(): OrderTypeSelection | null {
  return useContext(OrderTypeContext);
}
