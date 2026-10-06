// Reading CSV (RFC 4180): quoted cells may hold commas, quotes ("") and line breaks. Excel in some
// regions saves with semicolons or tabs, so the delimiter is detected from the header line.
const DELIMITERS = [",", ";", "\t"] as const;

function detectDelimiter(text: string): string {
  // Count each candidate in the first line, outside quotes.
  let best = ",";
  let bestCount = 0;
  for (const candidate of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (const ch of text) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && (ch === "\n" || ch === "\r")) break;
      else if (!quoted && ch === candidate) count++;
    }
    if (count > bestCount) [best, bestCount] = [candidate, count];
  }
  return best;
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}
