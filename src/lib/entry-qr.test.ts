import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { generateToken } from "@/lib/tokens";

// An entry QR is only any use if the gate's camera can read it back. This draws a code the way the
// browser would show it and decodes it with the same library the check-in screen uses.
function render(text: string, scale = 8, quiet = 4): { data: Uint8ClampedArray; size: number } {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
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

describe("entry QR codes", () => {
  it("are read back exactly by the scanner, for real tokens", () => {
    for (let i = 0; i < 20; i++) {
      const token = generateToken();
      const { data, size } = render(token);
      expect(jsQR(data, size, size)?.data).toBe(token);
    }
  });
  it("still read when drawn small, as on a phone screen or a printed card", () => {
    const token = generateToken();
    const { data, size } = render(token, 4);
    expect(jsQR(data, size, size)?.data).toBe(token);
  });
  it("give the PNG the guest's page and the email show", async () => {
    const png = await QRCode.toBuffer(generateToken(), {
      type: "png",
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});
