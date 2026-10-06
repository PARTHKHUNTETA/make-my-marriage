import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/dashboard", "/join/abc123TOKEN", "/settings/members", "/a?b=1&c=2", "/a#frag"])(
    "allows the site path %s",
    (path) => {
      expect(safeNext(path)).toBe(path);
    },
  );

  it.each([
    ["another site", "https://evil.example.com"],
    ["a protocol-relative URL", "//evil.example.com/x"],
    ["a backslash trick", "/\\evil.example.com"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path without a slash", "dashboard"],
    ["a data: URL", "data:text/html,hi"],
    ["a control character", "/ok\nSet-Cookie: x=1"],
    ["a tab", "/\t/evil.com"],
    ["an empty string", ""],
    ["a very long value", `/${"a".repeat(400)}`],
  ])("falls back for %s", (_label, value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });

  it("falls back when there is no value", () => {
    expect(safeNext(undefined)).toBe("/dashboard");
  });

  it("uses the first value if the parameter is repeated, and still checks it", () => {
    expect(safeNext(["/join/abc", "/other"])).toBe("/join/abc");
    expect(safeNext(["https://evil.example.com", "/ok"])).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeNext("//evil.com", "/setup")).toBe("/setup");
  });
});
