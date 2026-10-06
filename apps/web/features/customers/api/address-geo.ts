import type { CustomerAddress } from "../api/types";

export type MapAddress = Pick<
  CustomerAddress,
  | "line1"
  | "line2"
  | "locality"
  | "city"
  | "state"
  | "postal_code"
  | "country"
  | "latitude"
  | "longitude"
>;

/** Compose a geocodeable single-line address (empty parts skipped). */
export function composeAddress(a: Partial<MapAddress>): string {
  return [a.line1, a.line2, a.locality, a.city, a.state, a.postal_code, a.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

type AddressComponent = { long_name: string; short_name: string; types: string[] };

/** Map Google address_components onto our address fields (last action wins). */
export function parseComponents(components: AddressComponent[]): Partial<MapAddress> {
  const get = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)));
  const streetNumber = get("street_number")?.long_name ?? "";
  const route = get("route")?.long_name ?? "";
  const line1 = [streetNumber, route].filter(Boolean).join(" ");
  const out: Partial<MapAddress> = {};
  if (line1) out.line1 = line1;
  const locality = get("sublocality_level_1", "sublocality", "locality")?.long_name ?? "";
  if (locality) out.locality = locality;
  const city = get("locality", "administrative_area_level_3")?.long_name ?? "";
  if (city) out.city = city;
  const state = get("administrative_area_level_1")?.long_name ?? "";
  if (state) out.state = state;
  const postal = get("postal_code")?.short_name ?? "";
  if (postal) out.postal_code = postal;
  const country = get("country")?.short_name ?? "";
  if (country) out.country = country;
  return out;
}
