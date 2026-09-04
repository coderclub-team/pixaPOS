import { delay } from "@/constants/mock-api";
import type { Outlet, OutletPayload } from "./types";

let mockOutlet: Outlet = {
  id: "out_001",
  organization_id: "org_001",
  name: "PixaPOS Main Outlet",
  code: "PX001",
  alias: "Main",
  type: "restaurant",
  logo_url: "",
  phone: "9876543210",
  alternate_phone: "",
  email: "outlet@pixapos.com",
  website: "https://pixapos.com",
  whatsapp: "9876543210",
  address_line_1: "123 MG Road",
  address_line_2: "Near City Center",
  locality: "MG Road",
  city: "Ahmedabad",
  district: "Ahmedabad",
  state: "Gujarat",
  country: "India",
  postal_code: "380015",
  latitude: 23.0225,
  longitude: 72.5714,
  gst_registered: true,
  gstin: "24ABCDE1234F1Z5",
  legal_name: "PixaPOS Pvt Ltd",
  pan: "ABCDE1234F",
  fssai_number: "12345678901234",
  currency: "INR",
  timezone: "Asia/Kolkata",
  locale: "en-IN",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export async function getOutlet(): Promise<Outlet> {
  await delay(500);
  return { ...mockOutlet };
}

export async function updateOutlet(payload: OutletPayload): Promise<Outlet> {
  await delay(800);
  mockOutlet = { ...mockOutlet, ...payload, updated_at: new Date().toISOString() };
  return { ...mockOutlet };
}

export async function getOutletById(id: string): Promise<Outlet | null> {
  await delay(300);
  return mockOutlet.id === id ? { ...mockOutlet } : null;
}
