import { describe, expect, it } from "vitest";
import {
  approveFromSchema,
  guestSignSchema,
  MAX_FILES_PER_BATCH,
  requestUploadsSchema,
  uploadFileSchema,
} from "./schema";

const id = "0123456789abcdef01234567";
const file = (over: Record<string, unknown> = {}) => ({
  clientKey: "abcdefgh12345678",
  name: "IMG_1.jpg",
  type: "image/jpeg",
  size: 1000,
  ...over,
});

describe("uploadFileSchema", () => {
  it("accepts the four kinds and normalises the names phones use", () => {
    expect(uploadFileSchema.parse(file({ type: "image/jpg" })).type).toBe("image/jpeg");
    expect(uploadFileSchema.parse(file({ type: "image/heif" })).type).toBe("image/heic");
    expect(uploadFileSchema.parse(file({ type: "image/webp" })).type).toBe("image/webp");
  });
  it("refuses other kinds, empty files, files over 25 MB and bad keys", () => {
    for (const bad of [
      file({ type: "image/svg+xml" }),
      file({ type: "application/pdf" }),
      file({ size: 0 }),
      file({ size: 25 * 1024 * 1024 + 1 }),
      file({ size: 1.5 }),
      file({ clientKey: "short" }),
      file({ clientKey: "has spaces in it!!" }),
    ])
      expect(uploadFileSchema.safeParse(bad).success).toBe(false);
  });
  it("needs the exact size of each copy it says it will send, within the limit", () => {
    expect(uploadFileSchema.safeParse(file({ hasDisplay: true })).success).toBe(false);
    expect(uploadFileSchema.safeParse(file({ hasThumb: true })).success).toBe(false);
    expect(
      uploadFileSchema.safeParse(
        file({ hasDisplay: true, displaySize: 90_000, hasThumb: true, thumbSize: 9_000 }),
      ).success,
    ).toBe(true);
    expect(
      uploadFileSchema.safeParse(file({ hasDisplay: true, displaySize: 8 * 1024 * 1024 + 1 }))
        .success,
    ).toBe(false);
    expect(uploadFileSchema.safeParse(file({ hasDisplay: true, displaySize: 0 })).success).toBe(
      false,
    );
  });
  it("allows exactly 25 MB", () => {
    expect(uploadFileSchema.safeParse(file({ size: 25 * 1024 * 1024 })).success).toBe(true);
  });
});

describe("requestUploadsSchema", () => {
  it("allows 1 to 50 files for an album", () => {
    expect(requestUploadsSchema.safeParse({ albumId: id, files: [file()] }).success).toBe(true);
    expect(requestUploadsSchema.safeParse({ albumId: id, files: [] }).success).toBe(false);
    const many = Array.from({ length: MAX_FILES_PER_BATCH + 1 }, () => file());
    expect(requestUploadsSchema.safeParse({ albumId: id, files: many }).success).toBe(false);
    expect(requestUploadsSchema.safeParse({ albumId: "nope", files: [file()] }).success).toBe(
      false,
    );
  });
});

describe("guestSignSchema", () => {
  const parse = (name?: string) =>
    guestSignSchema.parse({
      albumId: id,
      files: [file()],
      ...(name === undefined ? {} : { name }),
    });
  it("takes the name as optional", () => {
    expect(parse().name).toBeUndefined();
    expect(parse("").name).toBeUndefined();
    expect(parse("   ").name).toBeUndefined();
  });
  it("tidies a name: trimmed, spaces collapsed, control characters gone", () => {
    expect(parse("  Meera   Shah ").name).toBe("Meera Shah");
    expect(parse("A\u0000B\nC").name).toBe("A B C");
  });
  it("refuses a name that is too long", () => {
    expect(
      guestSignSchema.safeParse({ albumId: id, files: [file()], name: "x".repeat(61) }).success,
    ).toBe(false);
  });
});

describe("approveFromSchema", () => {
  it("takes a name, or null for guests who gave none", () => {
    expect(approveFromSchema.parse({ uploader: "Meera" }).uploader).toBe("Meera");
    expect(approveFromSchema.parse({ uploader: null }).uploader).toBeNull();
    expect(approveFromSchema.safeParse({ uploader: "" }).success).toBe(false);
  });
});
