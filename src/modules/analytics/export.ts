import type { ChartData } from "./schema";

// The rows of a chart's CSV: a header, then one row per label. Money is written in rupees (not
// paise) so it opens correctly in a spreadsheet.
export function chartCsvRows(chart: ChartData): Array<Array<string | number>> {
  const value = (v: number) => (chart.unit === "rupees" ? Number((v / 100).toFixed(2)) : v);
  return [
    [
      chart.kind === "line" ? "Week of" : "Item",
      ...chart.series.map((s) => (chart.unit === "rupees" ? `${s.name} (₹)` : s.name)),
    ],
    ...chart.labels.map((label, i) => [label, ...chart.series.map((s) => value(s.values[i] ?? 0))]),
  ];
}

// A safe file name for a download.
export function chartFileName(chart: ChartData, ext: "png" | "csv"): string {
  return `${chart.id}.${ext}`;
}
