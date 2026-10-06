// Writing CSV for download. Spreadsheets run a cell that starts with = + - @ (or a tab or
// carriage return) as a formula, and guest names are typed by strangers' relatives, so such cells
// are prefixed with a quote to keep them as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;
// A plain number such as +919876543210 or -2 cannot run anything, so it is left as it is.
const PLAIN_NUMBER = /^[+-]?\d[\d .]*$/;

function cell(value: string | number | undefined | null): string {
  let text = value === undefined || value === null ? "" : String(value);
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Array<string | number | undefined | null>>): string {
  // The BOM makes Excel read the file as UTF-8, so Hindi names stay intact.
  return `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
