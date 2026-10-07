import { describe, expect, it } from "vitest";
import { formatTime } from "./time";

describe("formatTime", () => {
  it("reads a 24-hour time the way people say it", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("09:05")).toBe("9:05 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("16:00")).toBe("4:00 PM");
    expect(formatTime("23:59")).toBe("11:59 PM");
  });
});
