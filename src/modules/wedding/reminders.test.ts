import { describe, expect, it } from "vitest";
import { parseDays, reminderSettingsSchema } from "./schema";

describe("parseDays", () => {
  it("reads commas, spaces and semicolons", () => {
    expect(parseDays("14, 3")).toEqual([14, 3]);
    expect(parseDays(" 14  3;7 ")).toEqual([14, 3, 7]);
  });
  it("keeps junk as NaN so validation can reject it", () => {
    expect(parseDays("14, soon").some(Number.isNaN)).toBe(true);
    expect(parseDays("-3").some(Number.isNaN)).toBe(true);
    expect(parseDays("")).toEqual([]);
  });
});

describe("reminderSettingsSchema", () => {
  it("sorts largest first and drops repeats", () => {
    expect(reminderSettingsSchema.parse({ enabled: true, rsvpDays: [3, 14, 3] })).toEqual({
      enabled: true,
      rsvpDays: [14, 3],
    });
  });
  it("needs 1 to 5 whole days between 1 and 60", () => {
    for (const rsvpDays of [[], [0], [61], [1.5], [NaN], [1, 2, 3, 4, 5, 6]])
      expect(reminderSettingsSchema.safeParse({ enabled: true, rsvpDays }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ enabled: false, rsvpDays: [60] }).success).toBe(true);
  });
});
