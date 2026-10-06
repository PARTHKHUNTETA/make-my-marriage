// Money is stored as whole paise (₹1 = 100 paise), never as a decimal, so totals can never drift
// by a fraction (db-design §1). These helpers turn what people type into paise and back.

export const MAX_PAISE = 99_99_99_999_99; // ₹99,99,99,999.99, far below the safe integer limit

// "1,50,000" -> 15000000, "499.5" -> 49950, "₹ 12" -> 1200. Null if it is not a positive amount
// of rupees with at most 2 decimal places.
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
  return paise > 0 && paise <= MAX_PAISE ? paise : null;
}

// 15000000 -> "₹1,50,000", 49950 -> "₹499.50" (Indian digit grouping, decimals only when needed).
export function formatRupees(paise: number): string {
  const whole = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(paise / 100);
}

// For a form field: 15000000 -> "150000", 49950 -> "499.50".
export function toRupeeInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
