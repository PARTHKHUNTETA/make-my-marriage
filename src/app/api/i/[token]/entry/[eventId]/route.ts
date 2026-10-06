import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { jsonError } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { getEntryTokenForGuest } from "@/modules/guests/service";

export const dynamic = "force-dynamic";

// GET /api/i/[token]/entry/[eventId]: a guest's entry QR for one event, as a PNG. It is an image
// address so it also works inside an email, where inline pictures are not reliable. The guest's
// personal link is the only credential, and only a party that is coming gets a code.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; eventId: string }> },
) {
  try {
    await consumeRateLimit("entry-qr", subjectKey("ip", clientIp(request.headers)), {
      limit: 120,
      windowSeconds: 15 * 60,
    });
    const { token, eventId } = await params;
    const entryToken = await getEntryTokenForGuest(token, eventId);
    if (!entryToken) throw new AppError("NOT_FOUND", "There is no entry code for this.");
    const png = await QRCode.toBuffer(entryToken, {
      type: "png",
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Private to the guest's own device, never stored by shared caches.
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
