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
  upi_id: "",
  upi_ids: [],
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

const VPA_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

/** Add a UPI VPA. First account becomes the default automatically. */
export async function addUpiAccount(label: string, vpa: string): Promise<Outlet> {
  await delay(300);
  const cleanLabel = label.trim();
  const cleanVpa = vpa.trim();
  if (cleanLabel.length < 2) throw new Error("Label must be at least 2 characters");
  if (!VPA_RE.test(cleanVpa)) throw new Error("Enter a valid UPI ID (e.g. outlet@okhdfc)");
  loadOutletIds();
  if (mockOutlet.upi_ids.some((u) => u.vpa.toLowerCase() === cleanVpa.toLowerCase())) {
    throw new Error("This UPI ID is already added");
  }
  const account = {
    id: `upi_${Date.now().toString(36)}`,
    label: cleanLabel,
    vpa: cleanVpa,
    is_active: mockOutlet.upi_ids.length === 0,
    created_at: new Date().toISOString(),
  };
  mockOutlet = {
    ...mockOutlet,
    upi_ids: [...mockOutlet.upi_ids, account],
    updated_at: new Date().toISOString(),
  };
  return { ...mockOutlet };
}

/** Set exactly one default VPA (manual default — no implicit fallback). */
export async function setDefaultUpiAccount(id: string): Promise<Outlet> {
  await delay(300);
  loadOutletIds();
  if (!mockOutlet.upi_ids.some((u) => u.id === id)) throw new Error("UPI account not found");
  mockOutlet = {
    ...mockOutlet,
    upi_ids: mockOutlet.upi_ids.map((u) => ({ ...u, is_active: u.id === id })),
    updated_at: new Date().toISOString(),
  };
  return { ...mockOutlet };
}

/** Remove a VPA. If the default goes away, the oldest remaining becomes
 * default so bill QR keeps working (announced via toast at the call site). */
export async function removeUpiAccount(id: string): Promise<{ outlet: Outlet; promoted: boolean }> {
  await delay(300);
  loadOutletIds();
  const target = mockOutlet.upi_ids.find((u) => u.id === id);
  if (!target) throw new Error("UPI account not found");
  let rest = mockOutlet.upi_ids.filter((u) => u.id !== id);
  let promoted = false;
  if (target.is_active && rest.length > 0) {
    rest = rest.map((u, i) => ({ ...u, is_active: i === 0 }));
    promoted = true;
  }
  mockOutlet = { ...mockOutlet, upi_ids: rest, updated_at: new Date().toISOString() };
  return { outlet: { ...mockOutlet }, promoted };
}

/** Backfill for the single-VPA era + storage safety. */
function loadOutletIds(): void {
  if (!Array.isArray(mockOutlet.upi_ids)) mockOutlet.upi_ids = [];
  if (mockOutlet.upi_id && !mockOutlet.upi_ids.some((u) => u.vpa === mockOutlet.upi_id)) {
    mockOutlet.upi_ids = [
      ...mockOutlet.upi_ids,
      {
        id: "upi_legacy",
        label: "Counter",
        vpa: mockOutlet.upi_id,
        is_active: mockOutlet.upi_ids.length === 0,
        created_at: new Date().toISOString(),
      },
    ];
  }
}
