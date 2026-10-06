// Axis maths for the charts, pure so it can be tested.

// A tidy top value and evenly spaced ticks from zero, so the axis reads 0, 20, 40... not 0, 17, 34...
export function niceScale(max: number, wanted = 5): { top: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0)
    return { top: wanted, ticks: Array.from({ length: wanted + 1 }, (_, i) => i) };
  const rough = max / wanted;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const count = Math.ceil(max / step);
  return { top: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

// "₹1.2L", "₹50K", "₹800" for an axis (paise in); plain numbers for counts.
export function compactValue(value: number, unit: "rupees" | "count"): string {
  if (unit === "count") return String(Math.round(value));
  const rupees = value / 100;
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (rupees >= 1_00_00_000) return `₹${trim(rupees / 1_00_00_000)}Cr`;
  if (rupees >= 1_00_000) return `₹${trim(rupees / 1_00_000)}L`;
  if (rupees >= 1000) return `₹${trim(rupees / 1000)}K`;
  return `₹${Math.round(rupees)}`;
}

// Shortens a long label to fit under a bar.
export function clip(label: string, max = 14): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}
