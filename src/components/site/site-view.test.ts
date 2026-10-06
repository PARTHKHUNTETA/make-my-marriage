import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SiteData } from "@/modules/website/schema";
import { THEMES } from "@/modules/wedding/schema";
import { SiteView } from "./site-view";

const full = (theme: SiteData["theme"], over: Partial<SiteData> = {}): SiteData => ({
  slug: "priya-weds-aarav",
  theme,
  brideName: "Priya",
  groomName: "Aarav",
  date: new Date("2099-02-14T00:00:00+05:30"),
  city: "Jaipur",
  welcome: "Welcome to our wedding!",
  events: [
    {
      id: "e1",
      name: "Sangeet",
      date: new Date("2099-02-13T00:00:00+05:30"),
      startTime: "19:00",
      endTime: "23:00",
      dressCode: "Indo-western",
      venueName: "Royal Garden",
      address: "1 Palace Road",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Royal%20Garden",
    },
  ],
  live: {
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  isPreview: false,
  ...over,
});
const render = (site: SiteData) => renderToStaticMarkup(createElement(SiteView, { site }));

describe.each(THEMES)("%s theme", (theme) => {
  it("renders every section", () => {
    const html = render(full(theme));
    for (const text of [
      "Priya",
      "Aarav",
      "14 February 2099",
      "Jaipur",
      "Welcome to our wedding!",
      "Sangeet",
      "7:00 PM",
      "Indo-western",
      "Royal Garden",
      "1 Palace Road",
      "Open in Google Maps",
      "Watch the wedding live",
    ])
      expect(html).toContain(text);
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
  });

  it("copes with everything optional missing: no welcome, no events, no live link", () => {
    const html = render(full(theme, { welcome: undefined, events: [], live: undefined }));
    expect(html).toContain("Priya");
    expect(html).not.toContain("Welcome");
    expect(html).not.toContain("celebrations");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("undefined");
  });

  it("copes with an event that has no venue, address, end time or dress code", () => {
    const html = render(
      full(theme, {
        events: [
          {
            id: "e",
            name: "Roka",
            date: new Date("2099-01-01T00:00:00+05:30"),
            startTime: "10:00",
            mapsUrl: null,
          },
        ],
      }),
    );
    expect(html).toContain("Venue to be announced");
    expect(html).not.toContain("Open in Google Maps");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("has no RSVP form, since replies happen only through each guest's own link", () => {
    const html = render(full(theme));
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html.toLowerCase()).not.toContain("rsvp");
  });

  it("escapes what the couple typed", () => {
    const html = render(
      full(theme, { welcome: "<script>alert(1)</script>", brideName: "<b>X</b>" }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>X</b>");
  });

  it("labels the video 'Watch the wedding' once the wedding day has passed", () => {
    const html = render(full(theme, { date: new Date("2020-01-01T00:00:00+05:30") }));
    expect(html).toContain("Watch the wedding");
    expect(html).not.toContain("Watch the wedding live");
  });

  it("marks a preview, and a live site carries no such banner", () => {
    expect(render(full(theme, { isPreview: true }))).toContain("Preview");
    expect(render(full(theme))).not.toContain("Preview");
  });
});

describe("themes", () => {
  it("really look different from one another", () => {
    const [a, b, c] = THEMES.map((t) => render(full(t)));
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
