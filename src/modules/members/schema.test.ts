import { describe, expect, it } from "vitest";
import {
  loginSchema,
  PASSWORD_MAX,
  PASSWORD_MIN,
  resetPasswordSchema,
  resetRequestSchema,
  signupSchema,
  verifyEmailSchema,
} from "./schema";

const valid = {
  name: "Priya Sharma",
  email: "priya@example.com",
  password: "a-long-enough-password",
};

describe("signupSchema", () => {
  it("accepts a valid sign-up", () => {
    expect(signupSchema.parse(valid)).toEqual(valid);
  });

  it("trims the name and lowercases the email", () => {
    const out = signupSchema.parse({ ...valid, name: "  Priya  ", email: "  Priya@Example.COM " });
    expect(out.name).toBe("Priya");
    expect(out.email).toBe("priya@example.com");
  });

  it("keeps the password exactly as typed (no trimming)", () => {
    const password = "  spaces are part of it  ";
    expect(signupSchema.parse({ ...valid, password }).password).toBe(password);
  });

  it.each([
    ["empty name", { name: "   " }],
    ["name over 100 characters", { name: "x".repeat(101) }],
    ["not an email", { email: "priya-at-example" }],
    ["email over 254 characters", { email: `${"a".repeat(250)}@example.com` }],
    [`password under ${PASSWORD_MIN}`, { password: "x".repeat(PASSWORD_MIN - 1) }],
    [`password over ${PASSWORD_MAX}`, { password: "x".repeat(PASSWORD_MAX + 1) }],
  ])("rejects %s", (_label, patch) => {
    expect(signupSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("accepts a password at exactly the minimum and maximum", () => {
    expect(signupSchema.safeParse({ ...valid, password: "x".repeat(PASSWORD_MIN) }).success).toBe(
      true,
    );
    expect(signupSchema.safeParse({ ...valid, password: "x".repeat(PASSWORD_MAX) }).success).toBe(
      true,
    );
  });
});

describe("loginSchema", () => {
  it("defaults remember to false", () => {
    expect(loginSchema.parse({ email: "a@b.co", password: "x" }).remember).toBe(false);
  });

  it("does not apply the sign-up length policy to existing passwords", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(true);
  });

  it("rejects an empty password and a bad email", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("rejects a non-boolean remember", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x", remember: "yes" }).success).toBe(
      false,
    );
  });
});

describe("resetRequestSchema", () => {
  it("normalises the email", () => {
    expect(resetRequestSchema.parse({ email: "  Priya@Example.COM " }).email).toBe(
      "priya@example.com",
    );
  });
  it("rejects a malformed email", () => {
    expect(resetRequestSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  const token = "abcdefghijklmnopqrstuv";
  it("applies the same password policy as sign-up", () => {
    expect(
      resetPasswordSchema.safeParse({ token, password: "x".repeat(PASSWORD_MIN) }).success,
    ).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: "short" }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token, password: "x".repeat(PASSWORD_MAX + 1) }).success,
    ).toBe(false);
  });
  it("rejects junk tokens before they reach the database", () => {
    for (const bad of ["", "short", "x".repeat(200)]) {
      expect(
        resetPasswordSchema.safeParse({ token: bad, password: "a-long-enough-password" }).success,
      ).toBe(false);
    }
  });
});

describe("verifyEmailSchema", () => {
  it("accepts a token-shaped value and rejects junk", () => {
    expect(verifyEmailSchema.safeParse({ token: "abcdefghijklmnopqrstuv" }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ token: "" }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({}).success).toBe(false);
  });
});
