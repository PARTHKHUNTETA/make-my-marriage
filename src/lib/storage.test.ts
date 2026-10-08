import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-test-secret-test-secret-123";
const KEY = "weddings/0123456789abcdef01234567/photos/0123456789abcdef01234567/original";

async function load(r2 = false) {
  vi.resetModules();
  vi.stubEnv("SESSION_SECRET", SECRET);
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"])
    vi.stubEnv(name, r2 ? "test-value" : "");
  return import("./storage");
}

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.unstubAllEnvs());

describe("upload addresses are bound to an exact size", () => {
  it("real storage signs content-length as well as content-type", async () => {
    const storage = await load(true);
    const url = new URL(await storage.signUpload(KEY, "image/jpeg", 12345));
    const signed = (url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
    expect(signed).toContain("content-length");
    expect(signed).toContain("content-type");
  });

  it("the development driver signs the size, so a different size does not verify", async () => {
    const storage = await load();
    const url = new URL(await storage.signUpload(KEY, "image/jpeg", 500), "http://localhost");
    const q = url.searchParams;
    const check = (size: number) =>
      storage.verifyLocalSignature(
        "PUT",
        KEY,
        Number(q.get("e")),
        storage.localPutBinding("image/jpeg", size),
        q.get("s") ?? "",
      );
    expect(q.get("n")).toBe("500");
    expect(check(500)).toBe(true);
    expect(check(501)).toBe(false);
    expect(check(1)).toBe(false);
  });

  it("refuses a size that is not a positive whole number of bytes", async () => {
    const storage = await load();
    for (const bad of [0, -5, 1.5, Number.NaN])
      await expect(storage.signUpload(KEY, "image/jpeg", bad)).rejects.toThrow();
  });
});
