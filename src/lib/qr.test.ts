import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { generateToken } from "@/lib/tokens";

vi.mock("server-only", () => ({}));

// The same code the poster uses (error correction "Q"), drawn as a camera would see it and read
// back with the scanner library.
function render(text: string, scale = 8, quiet = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "Q" });
  const n = qr.modules.size;
  const size = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(x, y))
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
  return { data, size };
}

describe("gallery QR codes", () => {
  it("are read back exactly for real gallery links", () => {
    for (let i = 0; i < 10; i++) {
      const link = `https://makemymarriage.com/g/${generateToken()}`;
      const { data, size } = render(link);
      expect(jsQR(data, size, size)?.data).toBe(link);
    }
  });

  it("come out as a real PNG, an SVG, and an SVG data address", async () => {
    const { qrPng, qrSvg, qrDataUrl } = await import("./qr");
    const png = await qrPng("https://example.com/g/x", 400);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(await qrSvg("https://example.com/g/x")).toContain("<svg");
    const url = await qrDataUrl("https://example.com/g/x");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(Buffer.from(url.split(",")[1]!, "base64").toString()).toContain("<svg");
  });
});
