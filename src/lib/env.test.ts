import { afterEach, describe, expect, it, vi } from "vitest";

// getEnv caches its result, so every test loads a fresh copy of the module.
async function loadGetEnv() {
  vi.resetModules();
  return (await import("./env")).getEnv;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubAll(values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
}

describe("getEnv", () => {
  it("parses a complete environment", async () => {
    stubAll({
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB: "makemymarriage_test",
      APP_ROOT_DOMAIN: "localhost:3000",
    });
    const getEnv = await loadGetEnv();
    expect(getEnv()).toEqual({
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB: "makemymarriage_test",
      APP_ROOT_DOMAIN: "localhost:3000",
    });
  });

  it("returns the same parsed object on repeat calls", async () => {
    stubAll({ MONGODB_URI: "mongodb://x", MONGODB_DB: "d", APP_ROOT_DOMAIN: "localhost:3000" });
    const getEnv = await loadGetEnv();
    expect(getEnv()).toBe(getEnv());
  });

  it("names the missing variables but never prints values", async () => {
    stubAll({
      MONGODB_URI: "mongodb+srv://user:SuperSecretPassword@cluster.example.net",
      MONGODB_DB: "",
      APP_ROOT_DOMAIN: "",
    });
    const getEnv = await loadGetEnv();
    expect(() => getEnv()).toThrowError(/MONGODB_DB/);
    expect(() => getEnv()).toThrowError(/APP_ROOT_DOMAIN/);
    try {
      getEnv();
    } catch (err) {
      expect(String(err)).not.toContain("SuperSecretPassword");
      expect(String(err)).not.toContain("MONGODB_URI");
    }
  });
});
