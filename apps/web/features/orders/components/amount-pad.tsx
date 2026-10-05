"use client";

import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

export type PadKey =
  | { kind: "digit"; digit: string }
  | { kind: "backspace" }
  | { kind: "clear" }
  | { kind: "decimal" }
  | { kind: "denomination"; paise: number }
  | { kind: "exact"; amount: string };

/**
 * Pure pad state machine (Rupee-first entry, paise-exact, string only).
 * "310" means Rs 310.00; "." switches to paise digits (max 2). No floats.
 */
export function applyPadKey(state: string, key: PadKey): string {
  switch (key.kind) {
    case "clear":
      return "";
    case "backspace":
      return state.slice(0, -1);
    case "decimal": {
      if (state.includes(".")) return state;
      return state === "" ? "0." : `${state}.`;
    }
    case "digit": {
      if (key.digit === "00") {
        if (state === "" || state === "0") return state === "" ? "" : state;
      }
      const next = `${state}${key.digit}`;
      const [whole, frac] = next.split(".");
      if (frac !== undefined && frac.length > 2) return state;
      if (whole.replace("-", "").length > 7) return state;
      return next;
    }
    case "denomination": {
      const base = state === "" ? 0 : Math.round(Number(state) * 100);
      if (!Number.isFinite(base)) return state;
      const total = base + key.paise;
      return (total / 100)
        .toFixed(2)
        .replace(/\.00$/, "")
        .replace(/(\.\d)0$/, "$1");
    }
    case "exact":
      return key.amount;
  }
}

/** Format a rupee string for display (never for math). */
export function displayPadValue(state: string): string {
  if (state === "") return "0";
  return state;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const DENOMINATIONS = [
  { label: "₹10", paise: 1000 },
  { label: "₹20", paise: 2000 },
  { label: "₹50", paise: 5000 },
  { label: "₹100", paise: 10000 },
  { label: "₹500", paise: 50000 },
];

/**
 * POS number pad: touch-first tender entry without the OS keyboard.
 * Controlled over the parent's string state — additive to real keyboards.
 */
export default function AmountPad({
  value,
  onChange,
  onDone,
  showDenominations = false,
  allowDecimal = true,
  dueAmount,
}: {
  value: string;
  onChange: (next: string) => void;
  onDone?: () => void;
  showDenominations?: boolean;
  allowDecimal?: boolean;
  /** Exact-fill target (due amount as rupee string). Enables the Exact key. */
  dueAmount?: string;
}) {
  const press = (key: PadKey) => onChange(applyPadKey(value, key));

  return (
    <div className="space-y-2 rounded-xl border p-2">
      {showDenominations && (
        <div className="grid grid-cols-5 gap-1.5">
          {DENOMINATIONS.map((d) => (
            <Button
              key={d.label}
              type="button"
              variant="outline"
              className="h-11 text-sm font-semibold touch-manipulation"
              onClick={() => press({ kind: "denomination", paise: d.paise })}
            >
              {d.label}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {DIGITS.map((d) => (
          <Button
            key={d}
            type="button"
            variant="outline"
            className="h-14 text-lg font-semibold touch-manipulation"
            onClick={() => press({ kind: "digit", digit: d })}
          >
            {d}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-14 text-lg font-semibold touch-manipulation"
          onClick={() => press({ kind: "clear" })}
          title="Clear"
        >
          C
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 text-lg font-semibold touch-manipulation"
          onClick={() => press({ kind: "digit", digit: "0" })}
        >
          0
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 text-lg font-semibold touch-manipulation"
          onClick={() => press({ kind: "digit", digit: "00" })}
        >
          00
        </Button>
        {allowDecimal ? (
          <Button
            type="button"
            variant="outline"
            className="h-14 text-lg font-semibold touch-manipulation"
            onClick={() => press({ kind: "decimal" })}
          >
            .
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-14 text-lg font-semibold touch-manipulation"
            onClick={() => press({ kind: "backspace" })}
            title="Backspace"
          >
            <Icons.backspace className="size-5" />
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-14 text-lg font-semibold touch-manipulation"
          onClick={() => press({ kind: "backspace" })}
          title="Backspace"
        >
          <Icons.backspace className="size-5" />
        </Button>
        {dueAmount !== undefined && (
          <Button
            type="button"
            variant="secondary"
            className="col-span-3 h-11 text-sm font-semibold touch-manipulation"
            onClick={() => {
              press({ kind: "exact", amount: dueAmount });
              onDone?.();
            }}
          >
            Exact {dueAmount}
          </Button>
        )}
      </div>
    </div>
  );
}
