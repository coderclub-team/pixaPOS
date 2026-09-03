export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: opts.month ?? "long",
      day: opts.day ?? "numeric",
      year: opts.year ?? "numeric",
      ...opts,
    }).format(new Date(date));
  } catch {
    return "";
  }
}

export function formatCurrency(value: number, opts: { locale?: string; currency?: string } = {}) {
  const { locale = "en-IN", currency = "INR" } = opts;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

export function formatCurrencyString(amountWithSign: string) {
  const num = parseFloat(amountWithSign.replace(/[^0-9.-]/g, ""));
  const sign = amountWithSign.trim().startsWith("-")
    ? "-"
    : amountWithSign.trim().startsWith("+")
      ? "+"
      : "";
  return `${sign}${formatCurrency(Math.abs(num))}`;
}
