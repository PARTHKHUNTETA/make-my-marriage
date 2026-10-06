import { describe, expect, it } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it("reads like a person would say it", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(300)).toBe("1 KB");
    expect(formatBytes(820_000)).toBe("820 KB");
    expect(formatBytes(2_500_000)).toBe("2.5 MB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("26.2 MB");
    expect(formatBytes(10 * 1024 ** 3)).toBe("10.7 GB");
    expect(formatBytes(1_000_000_000)).toBe("1 GB");
    expect(formatBytes(NaN)).toBe("0 KB");
  });
});
