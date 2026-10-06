import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines, and ends rows with CRLF", () => {
    expect(toCsv([["a", 'b "c"', "d,e", "f\ng"]])).toBe('﻿a,"b ""c""","d,e","f\ng"\r\n');
  });
  it("leaves empty cells empty and keeps numbers", () => {
    expect(toCsv([["x", undefined, null, 3]])).toBe("﻿x,,,3\r\n");
  });
  it("defuses spreadsheet formulas", () => {
    expect(toCsv([['=HYPERLINK("http://evil")', "+1+1", "-A1", "@x", "ok"]])).toBe(
      '\uFEFF"\'=HYPERLINK(""http://evil"")",\'+1+1,\'-A1,\'@x,ok\r\n',
    );
  });

  it("leaves phone numbers and plain negative numbers alone", () => {
    expect(toCsv([["+919876543210", "+91 98765 43210", "-2", "-1.5"]])).toBe(
      "\uFEFF+919876543210,+91 98765 43210,-2,-1.5\r\n",
    );
  });
});
