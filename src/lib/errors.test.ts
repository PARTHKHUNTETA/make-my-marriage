import { describe, expect, it } from "vitest";
import { AppError, ERROR_STATUS, errorEnvelope, okEnvelope, type ErrorCode } from "./errors";

describe("ERROR_STATUS", () => {
  it("covers the 15 codes in api-design §15", () => {
    expect(Object.keys(ERROR_STATUS).sort()).toEqual(
      [
        "VALIDATION_FAILED",
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "LINK_INVALID",
        "EMAIL_IN_USE",
        "LAST_ADMIN",
        "RSVP_OVER_LIMIT",
        "RSVP_LOCKED",
        "TABLE_FULL",
        "NOT_INVITED",
        "STORAGE_FULL",
        "UPLOADS_CLOSED",
        "RATE_LIMITED",
        "INTERNAL",
      ].sort(),
    );
  });

  it.each<[ErrorCode, number]>([
    ["VALIDATION_FAILED", 400],
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["LINK_INVALID", 404],
    ["EMAIL_IN_USE", 409],
    ["LAST_ADMIN", 409],
    ["RSVP_OVER_LIMIT", 409],
    ["RSVP_LOCKED", 409],
    ["TABLE_FULL", 409],
    ["NOT_INVITED", 409],
    ["STORAGE_FULL", 409],
    ["UPLOADS_CLOSED", 409],
    ["RATE_LIMITED", 429],
    ["INTERNAL", 500],
  ])("maps %s to HTTP %i", (code, status) => {
    expect(ERROR_STATUS[code]).toBe(status);
  });
});

describe("AppError", () => {
  it("carries its code, message, details and HTTP status", () => {
    const err = new AppError("RSVP_OVER_LIMIT", "You can bring up to 4 people", { allowed: 4 });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AppError");
    expect(err.code).toBe("RSVP_OVER_LIMIT");
    expect(err.message).toBe("You can bring up to 4 people");
    expect(err.details).toEqual({ allowed: 4 });
    expect(err.status).toBe(409);
  });
});

describe("envelopes", () => {
  it("wraps success data", () => {
    expect(okEnvelope({ db: "up" })).toEqual({ ok: true, data: { db: "up" } });
  });

  it("wraps an error without leaking anything but code and message", () => {
    expect(errorEnvelope("LINK_INVALID", "This link isn't working")).toEqual({
      ok: false,
      error: { code: "LINK_INVALID", message: "This link isn't working" },
    });
  });
});
