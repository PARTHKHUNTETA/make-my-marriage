import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_ROWS,
  buildPreview,
  parseImportTable,
  rowsToImport,
  summarize,
  templateRows,
} from "./import";

const events = [
  { id: "507f1f77bcf86cd799439011", name: "Sangeet" },
  { id: "507f1f77bcf86cd799439012", name: "Wedding" },
  { id: "507f1f77bcf86cd799439013", name: "Grand Reception" },
];
const HEADER = ["Name", "Phone", "Email", "Guests allowed", "Invited events"];
const run = (rows: string[][], inUse = new Map<string, string>()) => {
  const parsed = parseImportTable([HEADER, ...rows]);
  expect(parsed.problem).toBeUndefined();
  return buildPreview(parsed.rows, events, inUse);
};

describe("parseImportTable", () => {
  it("numbers rows as the spreadsheet does (header is row 1) and skips blank lines", () => {
    const { rows } = parseImportTable([
      HEADER,
      ["A", "", "", "2", "Wedding"],
      ["", "", "", "", ""],
      ["B", "", "", "1", "Wedding"],
    ]);
    expect(rows.map((r) => [r.row, r.name])).toEqual([
      [2, "A"],
      [4, "B"],
    ]);
  });
  it("matches headers loosely and in any order", () => {
    const { rows, problem } = parseImportTable([
      ["  EVENTS ", "Party size", "Mobile number", "Guest Name"],
      ["Wedding", "3", "98765 43210", "Rao"],
    ]);
    expect(problem).toBeUndefined();
    expect(rows[0]).toMatchObject({
      name: "Rao",
      phone: "98765 43210",
      guestsAllowed: "3",
      events: "Wedding",
    });
  });
  it("explains which columns are missing", () => {
    expect(
      parseImportTable([
        ["Name", "Phone"],
        ["A", "1"],
      ]).problem,
    ).toMatch(/Guests allowed, Invited events/);
    expect(parseImportTable([]).problem).toMatch(/empty/);
    expect(parseImportTable([HEADER]).problem).toMatch(/no guests/);
  });
  it("refuses more than the row limit", () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [
      `G${i}`,
      "",
      "",
      "1",
      "Wedding",
    ]);
    expect(parseImportTable([HEADER, ...many]).problem).toMatch(/split the file/);
  });
});

describe("buildPreview", () => {
  it("accepts a clean row and turns it into guest input", () => {
    const [row] = run([
      ["Rajesh Sharma", "98765 43210", "Raj@Example.com", "4", "Sangeet; Wedding"],
    ]);
    expect(row).toMatchObject({
      status: "ok",
      phone: "+919876543210",
      email: "raj@example.com",
      eventNames: ["Sangeet", "Wedding"],
    });
    expect(row?.input).toMatchObject({
      name: "Rajesh Sharma",
      guestsAllowed: 4,
      phone: "+919876543210",
    });
    expect(row?.input?.invitedEventIds).toEqual([events[0]!.id, events[1]!.id]);
  });

  it("matches event names without regard to case or spacing, and splits on , ; and |", () => {
    const [a, b] = run([
      ["A", "", "", "1", "  sangeet ,  GRAND   reception "],
      ["B", "", "", "1", "Wedding|Sangeet"],
    ]);
    expect(a?.eventNames).toEqual(["Sangeet", "Grand Reception"]);
    expect(b?.eventNames).toEqual(["Wedding", "Sangeet"]);
  });

  it("'All' means every event", () => {
    expect(run([["A", "", "", "1", "all"]])[0]?.eventNames).toEqual(events.map((e) => e.name));
  });

  it("flags unknown events, naming them as typed", () => {
    const [row] = run([["A", "", "", "1", "Sangeet, Mehndi Night"]]);
    expect(row?.status).toBe("error");
    expect(row?.errors.join(" ")).toMatch(/Unknown event: Mehndi Night/);
    expect(row?.input).toBeUndefined();
  });

  it("flags every kind of bad row, with plain reasons", () => {
    const rows = run([
      ["", "", "", "2", "Wedding"],
      ["B", "123", "", "2", "Wedding"],
      ["C", "", "not-an-email", "2", "Wedding"],
      ["D", "", "", "", "Wedding"],
      ["E", "", "", "two", "Wedding"],
      ["F", "", "", "0", "Wedding"],
      ["G", "", "", "101", "Wedding"],
      ["H", "", "", "2.5", "Wedding"],
      ["I", "", "", "2", ""],
    ]);
    expect(rows.every((r) => r.status === "error")).toBe(true);
    expect(rows[0]!.errors.join()).toMatch(/name/i);
    expect(rows[1]!.errors.join()).toMatch(/phone/i);
    expect(rows[2]!.errors.join()).toMatch(/email/i);
    expect(rows[3]!.errors.join()).toMatch(/how many/i);
    for (const i of [4, 5, 6, 7])
      expect(rows[i]!.errors.join()).toMatch(/whole number from 1 to 100/);
    expect(rows[8]!.errors.join()).toMatch(/at least one event/i);
  });

  it("reports a problem once, not twice", () => {
    const [row] = run([["A", "", "", "x", "Nope"]]);
    expect(row!.errors).toHaveLength(2);
  });

  it("warns about a phone number already used by an existing guest", () => {
    const [row] = run(
      [["New Person", "98765 43210", "", "2", "Wedding"]],
      new Map([["+919876543210", "Rajesh Sharma"]]),
    );
    expect(row).toMatchObject({ status: "duplicate" });
    expect(row?.warnings).toEqual(["Rajesh Sharma already has this phone number."]);
    expect(row?.input).toBeDefined();
  });

  it("warns about the same phone number twice in the file, on the later row only", () => {
    const rows = run([
      ["A", "98765 43210", "", "2", "Wedding"],
      ["B", "+91 98765-43210", "", "2", "Wedding"],
      ["C", "", "", "2", "Wedding"],
      ["D", "", "", "2", "Wedding"],
    ]);
    expect(rows.map((r) => r.status)).toEqual(["ok", "duplicate", "ok", "ok"]); // blank phones never clash
    expect(rows[1]!.warnings).toEqual(["Same phone number as row 2."]);
  });

  it("an error outranks a duplicate warning", () => {
    const [row] = run(
      [["A", "98765 43210", "", "0", "Wedding"]],
      new Map([["+919876543210", "X"]]),
    );
    expect(row?.status).toBe("error");
  });
});

describe("rowsToImport and summarize", () => {
  const rows = run(
    [
      ["Ok", "", "", "2", "Wedding"],
      ["Dup", "98765 43210", "", "2", "Wedding"],
      ["Bad", "", "", "x", "Wedding"],
    ],
    new Map([["+919876543210", "Someone"]]),
  );

  it("counts the three outcomes", () => {
    expect(summarize(rows)).toEqual({ total: 3, ok: 1, duplicate: 1, error: 1 });
  });
  it("imports clean rows only by default", () => {
    expect(rowsToImport(rows, false).map((g) => g.name)).toEqual(["Ok"]);
  });
  it("adds duplicates only when asked, and never the rows with errors", () => {
    expect(rowsToImport(rows, true).map((g) => g.name)).toEqual(["Ok", "Dup"]);
  });
});

describe("templateRows", () => {
  it("uses the wedding's own event names in the examples", () => {
    const t = templateRows(["Mehndi", "Sangeet", "Wedding"]);
    expect(t[0]).toEqual(HEADER);
    expect(t[1]![4]).toBe("Mehndi; Sangeet");
    expect(t[2]![4]).toBe("Mehndi");
  });
  it("still works with no events", () => {
    expect(templateRows([])[1]![4]).toBe("Wedding");
  });
  it("the template itself imports cleanly", () => {
    const names = ["Sangeet", "Wedding"];
    const parsed = parseImportTable(templateRows(names));
    const preview = buildPreview(parsed.rows, events, new Map());
    expect(preview.map((r) => r.status)).toEqual(["ok", "ok"]);
  });
});
