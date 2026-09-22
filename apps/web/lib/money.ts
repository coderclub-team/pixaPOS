/** Paise boundary utils (ADR-0001). New order/payment code stores integer paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Thermal-printer-safe amount (ASCII only). ESC/POS code pages have no rupee
 * glyph — raw UTF-8 ₹ bytes render as mojibake (â + junk). Receipts print Rs.
 */
export function formatReceiptAmount(paise: number): string {
  return `Rs.${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
