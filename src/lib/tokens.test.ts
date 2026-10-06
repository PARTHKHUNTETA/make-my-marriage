import { describe, expect, it, vi } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("generateToken", () => {
  it("is always 22 base62 characters (128 bits)", () => {
    for (let i = 0; i < 200; i++) expect(generateToken()).toMatch(/^[0-9A-Za-z]{22}$/);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 5000 }, generateToken));
    expect(seen.size).toBe(5000);
  });

  it("pads small values so every token has the same length", async () => {
    vi.resetModules();
    vi.doMock("node:crypto", () => ({ randomBytes: () => Buffer.alloc(16) }));
    const { generateToken: zero } = await import("./tokens");
    expect(zero()).toBe("0".repeat(22));
    vi.doUnmock("node:crypto");
  });

  it("encodes the largest 128-bit value without overflowing 22 characters", async () => {
    vi.resetModules();
    vi.doMock("node:crypto", () => ({ randomBytes: () => Buffer.alloc(16, 0xff) }));
    const { generateToken: max } = await import("./tokens");
    expect(max()).toHaveLength(22);
    vi.doUnmock("node:crypto");
  });

  it("uses every part of the alphabet, not just digits", () => {
    const sample = Array.from({ length: 300 }, generateToken).join("");
    expect(sample).toMatch(/[0-9]/);
    expect(sample).toMatch(/[A-Z]/);
    expect(sample).toMatch(/[a-z]/);
  });
});

describe("hashToken", () => {
  it("is a stable 64-character hex digest", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken(generateToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different tokens and never contains the token", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toBe(hashToken(`${token}x`));
    expect(hashToken(token)).not.toContain(token);
  });
});
