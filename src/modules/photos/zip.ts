// How photos are split into ZIP downloads. Pure, so it can be tested without a database.
export type SizedRow = { bytes: number };

// A ZIP is built in the browser, so one is kept to a size a phone can hold. A big album simply
// comes as several parts.
export const ZIP_PART_BYTES = 400 * 1024 * 1024;
export const ZIP_PART_FILES = 150;

// Splits photos, in order, into parts that each stay under the limits (a single huge photo still
// gets a part of its own).
export function planParts<T extends SizedRow>(rows: T[]): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const row of rows) {
    if (
      current.length > 0 &&
      (current.length >= ZIP_PART_FILES || bytes + row.bytes > ZIP_PART_BYTES)
    ) {
      parts.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += row.bytes;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}
