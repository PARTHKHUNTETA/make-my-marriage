import { describe, expect, it } from "vitest";
import { websiteSettingsSchema } from "./schema";

const ID = "dQw4w9WgXcQ";
const valid = {
  isOn: true,
  theme: "minimal",
  slug: "priya-weds-aarav",
  showLive: false,
  youtubeUrl: "",
};
const parse = (over = {}) => websiteSettingsSchema.safeParse({ ...valid, ...over });

describe("websiteSettingsSchema", () => {
  it("accepts a normal set of settings", () => {
    expect(parse().success).toBe(true);
  });
  it("lowercases and trims the web address", () => {
    const r = parse({ slug: "  Priya-Weds-Aarav " });
    expect(r.success && r.data.slug).toBe("priya-weds-aarav");
  });
  it("refuses addresses that are the wrong shape", () => {
    for (const slug of [
      "ab",
      "x".repeat(51),
      "has space",
      "under_score",
      "-leading",
      "trailing-",
      "double--hyphen",
      "dot.dot",
      "ünïcode",
      "",
    ])
      expect(parse({ slug }).success).toBe(false);
  });
  it("refuses addresses that would clash with the app's own pages", () => {
    for (const slug of ["login", "dashboard", "staff", "vendors", "api", "settings"])
      expect(parse({ slug }).success).toBe(false);
  });
  it("knows only the three themes", () => {
    for (const theme of ["classical", "minimal", "modern"])
      expect(parse({ theme }).success).toBe(true);
    expect(parse({ theme: "gothic" }).success).toBe(false);
  });
  it("turns a YouTube link into a clean watch address, and blank into none", () => {
    const r = parse({ youtubeUrl: ` https://youtu.be/${ID}?si=tracking ` });
    expect(r.success && r.data.youtubeUrl).toBe(`https://www.youtube.com/watch?v=${ID}`);
    const none = parse({ youtubeUrl: "  " });
    expect(none.success && none.data.youtubeUrl).toBeNull();
  });
  it("refuses a link that is not YouTube, or not safe", () => {
    for (const youtubeUrl of [
      "https://vimeo.com/123",
      "javascript:alert(1)",
      `https://youtube.com.evil.com/watch?v=${ID}`,
      "just text",
    ])
      expect(parse({ youtubeUrl }).success).toBe(false);
  });
});
