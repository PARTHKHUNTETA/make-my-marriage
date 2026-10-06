import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { safeAction } from "./action";
import { AppError } from "./errors";
import { toFailure } from "./failure";

describe("toFailure", () => {
  it("maps a typed error to its code and HTTP status", () => {
    const { status, body } = toFailure(
      new AppError("LAST_ADMIN", "A wedding needs at least one Admin"),
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: { code: "LAST_ADMIN", message: "A wedding needs at least one Admin" },
    });
  });

  it("carries details on a typed error", () => {
    const { body } = toFailure(new AppError("RSVP_OVER_LIMIT", "Too many", { allowed: 4 }));
    expect(body.error.details).toEqual({ allowed: 4 });
  });

  it("turns a Zod failure into VALIDATION_FAILED with per-field messages", () => {
    const result = z
      .object({ email: z.email(), name: z.string().min(1) })
      .safeParse({ email: "x", name: "" });
    const { status, body } = toFailure(result.error);
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(body.error.details as object).sort()).toEqual(["email", "name"]);
  });

  it("hides an unexpected error behind INTERNAL and logs only its name", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = toFailure(new Error("connect mongodb+srv://u:SuperSecret@host"));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("SuperSecret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("SuperSecret");
    log.mockRestore();
  });
});

describe("safeAction", () => {
  it("wraps a result in the success envelope", async () => {
    expect(await safeAction(async () => ({ weddingId: "w1" }))).toEqual({
      ok: true,
      data: { weddingId: "w1" },
    });
  });

  it("returns a failure as a value instead of throwing", async () => {
    const result = await safeAction(async () => {
      throw new AppError("FORBIDDEN", "Only an admin can do this");
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "Only an admin can do this" },
    });
  });
});
