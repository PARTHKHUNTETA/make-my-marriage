import { describe, expect, it } from "vitest";
import { normalizeImageType, safeFileName, sniffImageType } from "./image-types";

const bytes = (...b: number[]) => Uint8Array.from(b);
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffImageType", () => {
  it("recognises JPEG, PNG, WebP and HEIC by their first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, ...text("JFIF")))).toBe(
      "image/jpeg",
    );
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13))).toBe(
      "image/png",
    );
    expect(sniffImageType(bytes(...text("RIFF"), 1, 2, 3, 4, ...text("WEBP")))).toBe("image/webp");
    expect(sniffImageType(bytes(0, 0, 0, 24, ...text("ftypheic")))).toBe("image/heic");
    expect(sniffImageType(bytes(0, 0, 0, 24, ...text("ftypmif1")))).toBe("image/heic");
  });
  it("refuses everything else, whatever it claims to be", () => {
    for (const evil of [
      text("<script>alert(1)</script>"),
      text("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00"),
      text("%PDF-1.7 and more bytes"),
      text("GIF89a......"),
      text("<svg xmlns='http://www.w3.org/2000/svg'/>"),
      [0, 0, 0, 24, ...text("ftypmp42")], // a video, not a photo
      text("RIFF....WAVEfmt "),
    ])
      expect(sniffImageType(Uint8Array.from(evil))).toBeNull();
  });
  it("is null for something too short to tell", () => {
    expect(sniffImageType(bytes())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});

describe("normalizeImageType", () => {
  it("accepts the four types and the names phones use", () => {
    expect(normalizeImageType("image/jpeg")).toBe("image/jpeg");
    expect(normalizeImageType("IMAGE/JPG")).toBe("image/jpeg");
    expect(normalizeImageType("image/heif")).toBe("image/heic");
    expect(normalizeImageType(" image/webp ")).toBe("image/webp");
  });
  it("refuses other types, including SVG", () => {
    for (const t of ["image/svg+xml", "image/gif", "text/html", "application/pdf", "video/mp4", ""])
      expect(normalizeImageType(t)).toBeNull();
  });
});

describe("safeFileName", () => {
  it("keeps a plain name, swapping the extension for the real type", () => {
    expect(safeFileName("IMG_2041.HEIC", "image/jpeg")).toBe("IMG_2041.jpg");
    expect(safeFileName("Haldi photo 3.jpeg", "image/jpeg")).toBe("Haldi photo 3.jpg");
  });
  it("can never be a path or a hidden file, and never empty", () => {
    expect(safeFileName("../../etc/passwd", "image/png")).not.toMatch(/[\\/]/);
    expect(safeFileName("..\\..\\secret", "image/png")).not.toMatch(/[\\/]/);
    expect(safeFileName(".htaccess", "image/png")).not.toMatch(/^\./);
    expect(safeFileName("", "image/webp")).toBe("photo.webp");
    expect(safeFileName("😀😀", "image/png")).toBe("_.png");
    expect(safeFileName("x".repeat(500), "image/png").length).toBeLessThanOrEqual(84);
  });
});
