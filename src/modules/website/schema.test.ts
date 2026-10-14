import { describe, expect, it } from "vitest";
import {
  liveSettingsSchema,
  siteDraftJsonSchema,
  siteBriefSchema,
  siteDraftSchema,
  websiteSettingsSchema,
} from "./schema";

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

describe("siteDraftSchema", () => {
  const good = {
    design: { palette: "royal-maroon", fonts: "royal", hero: "arch", motif: "mandala" },
    tagline: "Forever starts here",
    welcome: "Welcome!",
    story: { title: "How we met", body: "In college, in Pune." },
    eventsTitle: "The celebrations",
    venuesTitle: "Where to find us",
    faqs: [{ q: "What should I wear?", a: "Festive Indian wear." }],
    closingNote: null,
  };
  it("accepts a well-formed draft", () => {
    expect(siteDraftSchema.safeParse(good).success).toBe(true);
  });
  it("only accepts designs from the kit", () => {
    for (const design of [
      { ...good.design, palette: "neon" },
      { ...good.design, fonts: "comic-sans" },
      { ...good.design, hero: "video" },
      { ...good.design, motif: "skulls" },
    ])
      expect(siteDraftSchema.safeParse({ ...good, design }).success).toBe(false);
  });
  it("rejects text that is too long", () => {
    expect(siteDraftSchema.safeParse({ ...good, tagline: "x".repeat(121) }).success).toBe(false);
    expect(siteDraftSchema.safeParse({ ...good, faqs: Array(9).fill(good.faqs[0]) }).success).toBe(
      false,
    );
  });
  it("lists every field as required in the JSON schema given to the AI", () => {
    const props = Object.keys((siteDraftJsonSchema as { properties: object }).properties);
    expect((siteDraftJsonSchema as { required: string[] }).required).toEqual(props);
    expect(props.sort()).toEqual(Object.keys(siteDraftSchema.shape).sort());
  });
});

describe("siteBriefSchema", () => {
  it("needs at least a vibe, a colour or a few words", () => {
    expect(siteBriefSchema.safeParse({}).success).toBe(false);
    expect(siteBriefSchema.safeParse({ extra: "nice" }).success).toBe(false);
    expect(siteBriefSchema.safeParse({ vibes: ["royal"] }).success).toBe(true);
    expect(siteBriefSchema.safeParse({ colours: "peach and mint" }).success).toBe(true);
  });
  it("fills in defaults and trims", () => {
    expect(siteBriefSchema.parse({ vibes: ["fun"], howWeMet: "  At a wedding  " })).toEqual({
      vibes: ["fun"],
      colours: "",
      tone: null,
      language: "english",
      howWeMet: "At a wedding",
      extra: "",
      previous: null,
    });
  });
  it("accepts the previous draft only with a design from the kit", () => {
    const design = { palette: "royal-maroon", fonts: "royal", hero: "arch", motif: "mandala" };
    expect(
      siteBriefSchema.safeParse({ vibes: ["royal"], previous: { design, tagline: "Hi" } }).success,
    ).toBe(true);
    expect(
      siteBriefSchema.safeParse({
        vibes: ["royal"],
        previous: { design: { ...design, palette: "neon" }, tagline: "Hi" },
      }).success,
    ).toBe(false);
  });
  it("rejects unknown choices, more than 3 vibes and long text", () => {
    expect(siteBriefSchema.safeParse({ vibes: ["spooky"] }).success).toBe(false);
    expect(siteBriefSchema.safeParse({ vibes: ["royal", "fun", "boho", "beach"] }).success).toBe(
      false,
    );
    expect(siteBriefSchema.safeParse({ vibes: ["royal"], tone: "angry" }).success).toBe(false);
    expect(siteBriefSchema.safeParse({ howWeMet: "x".repeat(601) }).success).toBe(false);
  });
});
