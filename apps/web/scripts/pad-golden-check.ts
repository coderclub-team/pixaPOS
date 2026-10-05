/**
 * Golden check for the POS number pad state machine
 * (run: pnpm --filter @pixa/web exec tsx scripts/pad-golden-check.ts).
 */
import { applyPadKey, type PadKey } from "../features/orders/components/amount-pad";

let failures = 0;
function check(name: string, cond: boolean, extra = ""): void {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${extra}`);
  }
}

const d = (digit: string): PadKey => ({ kind: "digit", digit });

let s = "";
for (const k of ["3", "1", "0"]) s = applyPadKey(s, d(k));
check("rupee-first entry", s === "310", s);

s = applyPadKey("310", { kind: "decimal" });
s = applyPadKey(s, d("5"));
check("decimal paise digit", s === "310.5", s);
s = applyPadKey(s, d("0"));
s = applyPadKey(s, d("9"));
check("decimal capped at 2", s === "310.50", s);

check("leading decimal", applyPadKey("", { kind: "decimal" }) === "0.");
check("double decimal ignored", applyPadKey("1.5", { kind: "decimal" }) === "1.5");
check("backspace", applyPadKey("310", { kind: "backspace" }) === "31");
check("clear", applyPadKey("310.5", { kind: "clear" }) === "");
check("double-zero empty", applyPadKey("", d("00")) === "");
check("double-zero append", applyPadKey("31", d("00")) === "3100");

check("denomination adds", applyPadKey("100", { kind: "denomination", paise: 5000 }) === "150");
check("denomination from empty", applyPadKey("", { kind: "denomination", paise: 2000 }) === "20");
check(
  "denomination trims trailing zeros",
  applyPadKey("", { kind: "denomination", paise: 1050 }) === "10.5",
);
check("exact fills", applyPadKey("12", { kind: "exact", amount: "310.00" }) === "310.00");

console.log(failures === 0 ? "\nALL PAD CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
