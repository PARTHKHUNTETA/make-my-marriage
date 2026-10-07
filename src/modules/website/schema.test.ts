import { describe, expect, it } from "vitest";
import { liveSettingsSchema, websiteSettingsSchema } from "./schema";

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

describe("liveSettingsSchema", () => {
  const live = (over = {}) =>
    liveSettingsSchema.safeParse({ showLive: true, youtubeUrl: `https://youtu.be/${ID}`, ...over });
  it("takes a YouTube link and keeps only a clean watch address", () => {
    const r = live({ youtubeUrl: `  https://www.youtube.com/live/${ID}?feature=share&t=5  ` });
    expect(r.success && r.data.youtubeUrl).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
  it("needs a link to switch the live section on, and says so on the link field", () => {
    const r = live({ youtubeUrl: "" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues[0]).toMatchObject({
        path: ["youtubeUrl"],
        message: "Paste your YouTube link to show the live section",
      });
  });
  it("lets the section be off, with or without a saved link", () => {
    expect(live({ showLive: false, youtubeUrl: "" }).success).toBe(true);
    expect(live({ showLive: false }).success).toBe(true);
  });
  it("refuses anything that is not a YouTube link", () => {
    for (const bad of [
      "https://evil.example.com/watch?v=" + ID,
      "javascript:alert(1)",
      "not a link",
      `https://youtube.com.evil.test/watch?v=${ID}`,
    ]) {
      const r = live({ youtubeUrl: bad });
      expect(r.success, bad).toBe(false);
    }
  });
});
