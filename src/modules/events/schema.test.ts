import { describe, expect, it } from "vitest";
import { eventInputSchema, formatTime } from "./schema";

const valid = { type: "mehndi", name: "Mehndi Night", date: "2027-02-12", startTime: "16:00" };

describe("eventInputSchema", () => {
  it("accepts the required fields and defaults the website to on", () => {
    expect(eventInputSchema.parse(valid)).toMatchObject({ showOnWebsite: true });
  });
  it("lets an event end after midnight", () => {
    expect(
      eventInputSchema.safeParse({ ...valid, startTime: "21:00", endTime: "01:30" }).success,
    ).toBe(true);
  });
  it("treats blank optional fields as not set", () => {
    const parsed = eventInputSchema.parse({ ...valid, endTime: "", venueName: " ", dressCode: "" });
    expect(parsed).toMatchObject({
      endTime: undefined,
      venueName: undefined,
      dressCode: undefined,
    });
  });
  it("rejects a missing name, bad time, impossible date and unknown type", () => {
    for (const bad of [
      { name: " " },
      { startTime: "25:00" },
      { startTime: "" },
      { date: "2027-02-30" },
      { type: "birthday" },
    ])
      expect(eventInputSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
  });
  it("accepts a custom type with its own name", () => {
    expect(eventInputSchema.safeParse({ ...valid, type: "custom", name: "Nikah" }).success).toBe(
      true,
    );
  });
});

describe("formatTime", () => {
  it("shows 12-hour time", () => {
    expect(formatTime("16:00")).toBe("4:00 PM");
    expect(formatTime("00:30")).toBe("12:30 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("09:05")).toBe("9:05 AM");
  });
});
