import { beforeEach, describe, expect, it, vi } from "vitest";

const wedding = vi.hoisted(() => ({
  getWedding: vi.fn(),
  getWeddingBySlug: vi.fn(),
  getGallerySettings: vi.fn(),
  updateWebsite: vi.fn(),
  updateWebsiteContent: vi.fn(),
}));
const ai = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock("@/lib/ai", () => ai);
const events = vi.hoisted(() => ({ listEvents: vi.fn() }));
vi.mock("@/modules/wedding/service", () => wedding);
vi.mock("@/modules/events/service", () => events);
vi.mock("@/lib/app-url", () => ({ absoluteUrl: (path: string) => `https://example.test${path}` }));

import {
  generateSiteDraft,
  getPublicSite,
  getSitePreview,
  saveSiteContent,
  saveWebsiteSettings,
} from "./service";
import { THEME_PRESETS } from "@/themes/kit";
import { siteBriefSchema, type SiteDraft } from "./schema";

const ID = "dQw4w9WgXcQ";
const summary = (over: Record<string, unknown> = {}, website: Record<string, unknown> = {}) => ({
  id: "w1",
  brideName: "Priya",
  groomName: "Aarav",
  title: "Priya weds Aarav",
  date: new Date("2027-02-14T00:00:00+05:30"),
  city: "Jaipur",
  description: "Welcome, everyone!",
  slug: "priya-weds-aarav",
  website: {
    slug: "priya-weds-aarav",
    theme: "classical",
    isOn: true,
    showGallery: false,
    showLive: false,
    ...website,
  },
  ...over,
});
const event = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Event ${id}`,
  type: "custom",
  date: new Date("2027-02-13T00:00:00+05:30"),
  startTime: "19:00",
  showOnWebsite: true,
  ...over,
});

beforeEach(() => {
  Object.values(wedding).forEach((fn) => fn.mockReset());
  events.listEvents.mockReset().mockResolvedValue([]);
});

describe("the Photo gallery section", () => {
  it("has no link while the section is off, and never asks for the token", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(summary());
    const site = await getPublicSite("priya-weds-aarav");
    expect(site?.galleryUrl).toBeUndefined();
    expect(wedding.getGallerySettings).not.toHaveBeenCalled();
  });
  it("links to the private gallery when the section is on", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(summary({}, { showGallery: true }));
    wedding.getGallerySettings.mockResolvedValue({
      token: "TOKEN1234567890123456",
      uploadsOn: true,
      showOnWebsite: true,
    });
    const site = await getPublicSite("priya-weds-aarav");
    expect(site?.galleryUrl).toMatch(/\/g\/TOKEN1234567890123456$/);
  });
  it("is also in the preview the couple sees", async () => {
    wedding.getWedding.mockResolvedValue(summary({}, { showGallery: true, isOn: false }));
    wedding.getGallerySettings.mockResolvedValue({
      token: "TOKEN1234567890123456",
      uploadsOn: false,
      showOnWebsite: true,
    });
    expect((await getSitePreview("w1"))?.galleryUrl).toContain("/g/TOKEN1234567890123456");
  });
});

describe("getPublicSite", () => {
  it("is a plain not-found when there is no such wedding", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(null);
    expect(await getPublicSite("nobody")).toBeNull();
  });
  it("is a plain not-found while the site is off, so a hidden site looks like none", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(summary({}, { isOn: false }));
    expect(await getPublicSite("priya-weds-aarav")).toBeNull();
    expect(events.listEvents).not.toHaveBeenCalled();
  });
  it("shows the couple, the date, the welcome and the theme", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(summary());
    expect(await getPublicSite("priya-weds-aarav")).toMatchObject({
      brideName: "Priya",
      groomName: "Aarav",
      city: "Jaipur",
      welcome: "Welcome, everyone!",
      theme: "classical",
      isPreview: false,
    });
  });
  it("lists only events marked show on website, never a private one", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(summary());
    events.listEvents.mockResolvedValue([
      event("a"),
      event("private", { showOnWebsite: false }),
      event("b"),
    ]);
    const site = await getPublicSite("priya-weds-aarav");
    expect(site?.events.map((e) => e.id)).toEqual(["a", "b"]);
  });
  it("gives each event a maps link only when it has a place", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(summary());
    events.listEvents.mockResolvedValue([event("a", { venueName: "Royal Garden" }), event("b")]);
    const site = await getPublicSite("priya-weds-aarav");
    expect(site?.events[0]?.mapsUrl).toContain("Royal%20Garden");
    expect(site?.events[1]?.mapsUrl).toBeNull();
  });
  it("carries nothing but public fields", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(
      summary({
        overallBudget: 99_000_000,
        whatsappMessage: "secret",
        reminders: { enabled: true },
      }),
    );
    const json = JSON.stringify(await getPublicSite("priya-weds-aarav"));
    for (const secret of ["99000000", "secret", "reminders", "overallBudget", "w1"])
      expect(json).not.toContain(secret);
  });

  describe("live stream", () => {
    const url = `https://www.youtube.com/watch?v=${ID}`;
    it("is shown only when the section is on and a valid link is set", async () => {
      wedding.getWeddingBySlug.mockResolvedValue(summary({}, { showLive: true, youtubeUrl: url }));
      expect((await getPublicSite("x"))?.live).toEqual({
        embedUrl: `https://www.youtube-nocookie.com/embed/${ID}`,
        watchUrl: url,
      });
    });
    it("is left out when switched off, when there is no link, or when the stored link is not YouTube", async () => {
      for (const website of [
        { showLive: false, youtubeUrl: url },
        { showLive: true },
        { showLive: true, youtubeUrl: "https://evil.example.com/x" },
      ]) {
        wedding.getWeddingBySlug.mockResolvedValue(summary({}, website));
        expect((await getPublicSite("x"))?.live).toBeUndefined();
      }
    });
  });
});

describe("getSitePreview", () => {
  it("shows the site even while it is off, marked as a preview", async () => {
    wedding.getWedding.mockResolvedValue(summary({}, { isOn: false }));
    expect(await getSitePreview("w1")).toMatchObject({ brideName: "Priya", isPreview: true });
  });
  it("is null for a wedding that does not exist", async () => {
    wedding.getWedding.mockResolvedValue(null);
    expect(await getSitePreview("w1")).toBeNull();
  });
});

describe("saveWebsiteSettings", () => {
  it("passes the settings to the wedding", async () => {
    await saveWebsiteSettings("w1", {
      isOn: true,
      theme: "modern",
      slug: "our-day",
      showLive: true,
      showGallery: true,
      youtubeUrl: null,
    });
    expect(wedding.updateWebsite).toHaveBeenCalledWith("w1", {
      slug: "our-day",
      theme: "modern",
      isOn: true,
      showLive: true,
      showGallery: true,
      youtubeUrl: null,
    });
  });
});

const draft: SiteDraft = {
  design: { palette: "emerald-gold", fonts: "editorial", hero: "monogram", motif: "lotus" },
  tagline: "Two hearts, one celebration",
  welcome: "Welcome to our wedding!",
  story: null,
  eventsTitle: "Celebrations",
  venuesTitle: "Venues",
  faqs: [],
  closingNote: null,
};
const brief = siteBriefSchema.parse({
  vibes: ["royal"],
  colours: "maroon and gold",
  howWeMet: "College in Pune",
});

describe("generateSiteDraft", () => {
  beforeEach(() => {
    ai.generateStructured.mockReset().mockResolvedValue({
      value: draft,
      provider: "anthropic",
      model: "claude-opus-5-5",
      inputTokens: 100,
      outputTokens: 50,
    });
  });
  it("sends the wedding's facts, only events shown on the website, and the brief", async () => {
    wedding.getWedding.mockResolvedValue(summary({ coverImageKey: "covers/w1.jpg" }));
    events.listEvents.mockResolvedValue([
      event("a", { name: "Sangeet", type: "sangeet", venueName: "Royal Garden" }),
      event("p", { name: "Family puja", showOnWebsite: false }),
    ]);
    const result = await generateSiteDraft("w1", brief);
    expect(result).toEqual({ draft, provider: "anthropic", tokens: 150 });
    const { user, system } = ai.generateStructured.mock.calls[0]![1];
    expect(user).toContain("Couple: Priya (bride) and Aarav (groom)");
    expect(user).toContain("Cover photo: yes");
    expect(user).toContain("Sangeet (sangeet)");
    expect(user).toContain("Royal Garden");
    expect(user).not.toContain("Family puja");
    expect(user).toContain("Vibe: Royal");
    expect(user).toContain("Colours: maroon and gold");
    expect(user).toMatch(/<how_we_met>\nCollege in Pune\n<\/how_we_met>/);
    expect(system).toContain("Never invent");
    expect(system).toContain("royal-maroon");
  });
  it("is not found for a missing wedding, without calling the AI", async () => {
    wedding.getWedding.mockResolvedValue(null);
    await expect(generateSiteDraft("w1", brief)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(ai.generateStructured).not.toHaveBeenCalled();
  });
});

describe("saveSiteContent", () => {
  it("keeps the draft's design and words, dropping empty parts", async () => {
    await saveSiteContent("w1", draft);
    expect(wedding.updateWebsiteContent).toHaveBeenCalledWith("w1", {
      design: draft.design,
      tagline: draft.tagline,
      welcome: draft.welcome,
      eventsTitle: "Celebrations",
      venuesTitle: "Venues",
      faqs: [],
    });
  });
  it("goes back to the plain theme", async () => {
    await saveSiteContent("w1", null);
    expect(wedding.updateWebsiteContent).toHaveBeenCalledWith("w1", null);
  });
});

describe("the AI design and words on the site", () => {
  it("use the AI's design and welcome", async () => {
    const content = { ...draft, story: undefined, closingNote: undefined };
    wedding.getWeddingBySlug.mockResolvedValue(summary({}, { content }));
    const site = await getPublicSite("priya-weds-aarav");
    expect(site?.welcome).toBe("Welcome to our wedding!");
    expect(site?.design).toEqual(draft.design);
    expect(site?.content?.tagline).toBe("Two hearts, one celebration");
  });
  it("use the theme's preset when there is no AI design", async () => {
    wedding.getWeddingBySlug.mockResolvedValue(summary());
    expect((await getPublicSite("priya-weds-aarav"))?.design).toEqual(THEME_PRESETS.classical);
  });
});

describe("picking a theme by hand", () => {
  const input = {
    slug: "priya-weds-aarav",
    isOn: true,
    showLive: false,
    showGallery: false,
    youtubeUrl: null,
  };
  it("replaces an AI design when the theme changes", async () => {
    wedding.getWedding.mockResolvedValue(summary({}, { content: { ...draft } }));
    await saveWebsiteSettings("w1", { ...input, theme: "minimal" });
    expect(wedding.updateWebsite.mock.calls[0]![1]).toMatchObject({ clearDesign: true });
  });
  it("keeps the AI design when the theme stays the same", async () => {
    wedding.getWedding.mockResolvedValue(summary({}, { content: { ...draft } }));
    await saveWebsiteSettings("w1", { ...input, theme: "classical" });
    expect(wedding.updateWebsite.mock.calls[0]![1]).not.toHaveProperty("clearDesign");
  });
});
