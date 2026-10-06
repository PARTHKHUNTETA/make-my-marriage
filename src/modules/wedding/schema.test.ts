import { describe, expect, it } from "vitest";
import { createWeddingSchema, suggestTitle } from "./schema";

const valid = {
  brideName: "Priya",
  groomName: "Aarav",
  title: "Priya weds Aarav",
  date: "2026-02-14",
  city: "Jaipur",
};

describe("createWeddingSchema", () => {
  it("accepts the required fields alone", () => {
    expect(createWeddingSchema.parse(valid)).toEqual({
      ...valid,
      venue: undefined,
      description: undefined,
    });
  });

  it("keeps optional fields when given and trims everything", () => {
    const out = createWeddingSchema.parse({
      ...valid,
      brideName: "  Priya ",
      venue: " Rambagh Palace ",
      description: " Join us ",
    });
    expect(out).toMatchObject({
      brideName: "Priya",
      venue: "Rambagh Palace",
      description: "Join us",
    });
  });

  it("turns blank optional fields into 'not set'", () => {
    const out = createWeddingSchema.parse({ ...valid, venue: "   ", description: "" });
    expect(out.venue).toBeUndefined();
    expect(out.description).toBeUndefined();
  });

  it.each(["brideName", "groomName", "title", "city", "date"])("requires %s", (field) => {
    expect(createWeddingSchema.safeParse({ ...valid, [field]: "   " }).success).toBe(false);
    const without = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== field));
    expect(createWeddingSchema.safeParse(without).success).toBe(false);
  });

  it.each(["2026-02-30", "14/02/2026", "tomorrow", "2026-2-14"])("rejects the date %s", (date) => {
    const result = createWeddingSchema.safeParse({ ...valid, date });
    expect(result.success).toBe(false);
  });

  it("accepts dates in the past (a couple can set up after the wedding)", () => {
    expect(createWeddingSchema.safeParse({ ...valid, date: "2020-01-01" }).success).toBe(true);
  });

  it("enforces maximum lengths", () => {
    expect(createWeddingSchema.safeParse({ ...valid, brideName: "x".repeat(101) }).success).toBe(
      false,
    );
    expect(createWeddingSchema.safeParse({ ...valid, title: "x".repeat(151) }).success).toBe(false);
    expect(createWeddingSchema.safeParse({ ...valid, description: "x".repeat(1001) }).success).toBe(
      false,
    );
  });
});

describe("suggestTitle", () => {
  it("joins the two names", () => {
    expect(suggestTitle("Priya", "Aarav")).toBe("Priya weds Aarav");
    expect(suggestTitle("  Priya ", " Aarav  ")).toBe("Priya weds Aarav");
  });

  it("suggests nothing until both names are present", () => {
    expect(suggestTitle("Priya", "")).toBe("");
    expect(suggestTitle("", "")).toBe("");
  });
});
