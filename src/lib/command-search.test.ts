import { describe, expect, it } from "vitest";
import { matchEntries } from "./command-search";

const entries = [
  { label: "Add guest", keywords: "invite people new", href: "/guests/new" },
  { label: "Add event", keywords: "ceremony new", href: "/events/new" },
  { label: "Guest list & RSVPs", keywords: "people replies", href: "/guests" },
  { label: "Photos & QR Stream", keywords: "pictures gallery", href: "/photos" },
  { label: "Notifications", keywords: "alerts bell mute", href: "/settings/notifications" },
];
const labels = (q: string) => matchEntries(entries, q).map((e) => e.label);

describe("matchEntries", () => {
  it("returns everything, in order, for an empty search", () => {
    expect(labels("")).toEqual(entries.map((e) => e.label));
    expect(labels("   ")).toEqual(entries.map((e) => e.label));
  });
  it("finds by the start of a word, whatever the capital letters", () => {
    expect(labels("add gu")).toEqual(["Add guest"]);
    expect(labels("PHOT")).toEqual(["Photos & QR Stream"]);
  });
  it("finds by a keyword that is not in the label", () => {
    expect(labels("gallery")).toEqual(["Photos & QR Stream"]);
    expect(labels("alerts")).toEqual(["Notifications"]);
  });
  it("needs every word typed, in any order", () => {
    expect(labels("guest add")).toEqual(["Add guest"]);
    expect(labels("add zzz")).toEqual([]);
  });
  it("puts entries that start with what was typed before entries that merely contain it", () => {
    // "guest" starts "Guest list & RSVPs", but is only the second word of "Add guest".
    expect(labels("guest")).toEqual(["Guest list & RSVPs", "Add guest"]);
  });
  it("keeps the original order among equally good matches", () => {
    expect(labels("new")).toEqual(["Add guest", "Add event"]);
  });
  it("does not treat what is typed as a pattern", () => {
    expect(labels(".*")).toEqual([]);
    expect(labels("(")).toEqual([]);
  });
});
