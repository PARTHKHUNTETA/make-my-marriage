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

describe("getAuthEnv", () => {
  async function loadAuth() {
    vi.resetModules();
    return (await import("./env")).getAuthEnv;
  }

  it("accepts a secret of 32 or more characters", async () => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));
    const getAuthEnv = await loadAuth();
    expect(getAuthEnv().SESSION_SECRET).toHaveLength(32);
  });

  it("rejects a missing or short secret without printing it", async () => {
    vi.stubEnv("SESSION_SECRET", "short-secret-value");
    const getAuthEnv = await loadAuth();
    expect(() => getAuthEnv()).toThrowError(/SESSION_SECRET/);
    try {
      getAuthEnv();
    } catch (err) {
      expect(String(err)).not.toContain("short-secret-value");
    }
  });

  it("is independent of the database variables", async () => {
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("SESSION_SECRET", "y".repeat(40));
    const getAuthEnv = await loadAuth();
    expect(() => getAuthEnv()).not.toThrow();
  });
});

describe("getEmailEnv", () => {
  async function loadEmail() {
    vi.resetModules();
    return (await import("./env")).getEmailEnv;
  }

  it("treats missing and blank values as 'not set' and falls back to the sandbox sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const env = (await loadEmail())();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBe("Make My Marriage <onboarding@resend.dev>");
  });

  it("reads a key and sender when present", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_abc123");
    vi.stubEnv("EMAIL_FROM", "Make My Marriage <hello@mail.makemymarriage.com>");
    const env = (await loadEmail())();
    expect(env).toEqual({
      RESEND_API_KEY: "re_abc123",
      EMAIL_FROM: "Make My Marriage <hello@mail.makemymarriage.com>",
    });
  });
});

describe("getCronEnv", () => {
  async function loadCron() {
    vi.resetModules();
    return (await import("./env")).getCronEnv;
  }

  it("needs a secret of at least 32 characters and never prints it", async () => {
    vi.stubEnv("CRON_SECRET", "too-short-secret");
    const getCronEnv = await loadCron();
    expect(() => getCronEnv()).toThrowError(/CRON_SECRET/);
    expect(() => getCronEnv()).not.toThrowError(/too-short-secret/);
    vi.stubEnv("CRON_SECRET", "z".repeat(32));
    expect((await loadCron())().CRON_SECRET).toHaveLength(32);
  });
});
