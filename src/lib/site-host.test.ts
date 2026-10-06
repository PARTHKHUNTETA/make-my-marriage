import { describe, expect, it } from "vitest";
import { siteSlugFromHost } from "./site-host";

describe("siteSlugFromHost", () => {
  it.each([
    ["priya-aarav.makemymarriage.com", "makemymarriage.com", "priya-aarav"],
    ["demo.localhost:3000", "localhost:3000", "demo"],
    ["Demo.LocalHost:3000", "localhost:3000", "demo"],
    ["demo.localhost", "localhost:3000", "demo"],
    ["demo.localhost:4000", "localhost:3000", "demo"],
  ])("resolves %s against %s to %s", (host, root, expected) => {
    expect(siteSlugFromHost(host, root)).toBe(expected);
  });

  it.each([
    ["makemymarriage.com", "makemymarriage.com", "the apex domain"],
    ["localhost:3000", "localhost:3000", "bare localhost"],
    ["www.makemymarriage.com", "makemymarriage.com", "a reserved subdomain"],
    ["mail.makemymarriage.com", "makemymarriage.com", "a reserved subdomain"],
    ["a.b.makemymarriage.com", "makemymarriage.com", "a nested subdomain"],
    ["demo.example.org", "makemymarriage.com", "a different domain"],
    ["evilmakemymarriage.com", "makemymarriage.com", "a lookalike without a dot boundary"],
    ["demo.makemymarriage.com.evil.test", "makemymarriage.com", "a suffix attack"],
  ])("returns null for %s against %s (%s)", (host, root) => {
    expect(siteSlugFromHost(host, root)).toBeNull();
  });

  it("returns null when the host or root domain is missing", () => {
    expect(siteSlugFromHost(null, "makemymarriage.com")).toBeNull();
    expect(siteSlugFromHost("demo.makemymarriage.com", undefined)).toBeNull();
    expect(siteSlugFromHost("", "makemymarriage.com")).toBeNull();
  });
});
