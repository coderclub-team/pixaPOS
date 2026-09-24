/**
 * Golden check for customer address geo helpers
 * (run: pnpm --filter @pixa/web exec tsx scripts/customer-geo-check.ts).
 */
import { composeAddress, parseComponents } from "../features/customers/api/address-geo";

let failures = 0;
function check(name: string, cond: boolean, extra = ""): void {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${extra}`);
  }
}

check(
  "compose skips empties",
  composeAddress({
    line1: "12 MG Road",
    city: "Bengaluru",
    postal_code: "560038",
    country: "IN",
  }) === "12 MG Road, Bengaluru, 560038, IN",
);
check("compose empty", composeAddress({}) === "");

const parsed = parseComponents([
  { long_name: "221B", short_name: "221B", types: ["street_number"] },
  { long_name: "Baker Street", short_name: "Baker St", types: ["route"] },
  { long_name: "Bengaluru", short_name: "Bengaluru", types: ["locality", "political"] },
  { long_name: "Karnataka", short_name: "KA", types: ["administrative_area_level_1", "political"] },
  { long_name: "560001", short_name: "560001", types: ["postal_code"] },
  { long_name: "India", short_name: "IN", types: ["country", "political"] },
]);
check("parse street", parsed.line1 === "221B Baker Street", parsed.line1 ?? "");
check(
  "parse city/state/pin/country",
  parsed.city === "Bengaluru" &&
    parsed.state === "Karnataka" &&
    parsed.postal_code === "560001" &&
    parsed.country === "IN",
);
check("parse empty", Object.keys(parseComponents([])).length === 0);

console.log(failures === 0 ? "\nALL GEO CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
