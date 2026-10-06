// "1.4 GB", "820 KB": sizes as people read them, in the 1000-based units storage plans use.
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  if (unit === 0) return "1 KB";
  const text =
    value >= 100 || unit === 1
      ? Math.round(value).toString()
      : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${units[unit]}`;
}
