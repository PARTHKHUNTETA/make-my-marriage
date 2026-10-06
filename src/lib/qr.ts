import "server-only";
import QRCode from "qrcode";

// QR codes for the gallery link, as a PNG (to save and share) or an SVG (to print at any size).
// Error correction is high ("Q"), because a poster gets creased, photographed at an angle and
// scanned in poor light at a wedding.
const common = { margin: 2, errorCorrectionLevel: "Q" } as const;

export async function qrPng(text: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...common, type: "png", width });
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...common, type: "svg" });
}

// For an <img src>: an SVG as a data address, so the page needs no inline markup from the library.
export async function qrDataUrl(text: string): Promise<string> {
  return `data:image/svg+xml;base64,${Buffer.from(await qrSvg(text)).toString("base64")}`;
}
