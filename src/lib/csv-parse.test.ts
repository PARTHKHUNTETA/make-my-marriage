import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { parseCsv } from "./csv-parse";

describe("parseCsv", () => {
  it("reads rows and cells, with CRLF or LF line ends and no final newline", () => {
    expect(parseCsv("a,b\r\nc,d\ne,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });
  it("reads quoted cells with commas, doubled quotes and line breaks", () => {
    expect(parseCsv('"a,1","say ""hi""","line1\nline2"\n')).toEqual([
      ["a,1", 'say "hi"', "line1\nline2"],
    ]);
  });
  it("keeps empty cells and a trailing empty cell", () => {
    expect(parseCsv("a,,c,\n,,")).toEqual([
      ["a", "", "c", ""],
      ["", "", ""],
    ]);
  });
  it("drops the byte order mark Excel adds", () => {
    expect(parseCsv("﻿Name,Phone\nA,1")[0]).toEqual(["Name", "Phone"]);
  });
  it("detects semicolon and tab separated files", () => {
    expect(parseCsv("Name;Phone\nA;1")).toEqual([
      ["Name", "Phone"],
      ["A", "1"],
    ]);
    expect(parseCsv("Name\tPhone\nA\t1")).toEqual([
      ["Name", "Phone"],
      ["A", "1"],
    ]);
  });
  it("does not mistake a comma inside a quoted semicolon file for the separator", () => {
    expect(parseCsv('Name;Events\n"Rao, Mr";"A; B"')).toEqual([
      ["Name", "Events"],
      ["Rao, Mr", "A; B"],
    ]);
  });
  it("is empty for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
  it("round-trips what toCsv writes", () => {
    const rows = [
      ["Name", "Note"],
      ["Rajesh, Sr.", 'He said "yes"\nloudly'],
      ["Hindi नाम", ""],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
