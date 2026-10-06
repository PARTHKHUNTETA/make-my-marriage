import { describe, expect, it } from "vitest";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./passwords";

describe("passwords", () => {
  it("hashes with Argon2id and never stores the plain text", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("correct horse battery");
  });

  it("salts every hash, so equal passwords produce different hashes", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password-1"),
      hashPassword("same-password-1"),
    ]);
    expect(a).not.toBe(b);
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "Correct horse battery")).toBe(false);
    expect(await verifyPassword(hash, "")).toBe(false);
  });

  it("treats a malformed stored hash as a mismatch instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
    expect(await verifyPassword("", "anything")).toBe(false);
  });

  it("burnPasswordCheck resolves without revealing anything", async () => {
    await expect(burnPasswordCheck("whatever")).resolves.toBeUndefined();
  });
});
