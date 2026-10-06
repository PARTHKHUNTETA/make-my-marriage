import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { guestDownloadUrl, openGallery } from "@/modules/photos/gallery";

export const dynamic = "force-dynamic";

// GET /api/g/[token]/download/[photoId]: sends the guest to a save-as address for one approved
// photo. A plain link, so downloading needs no script.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> },
) {
  try {
    await consumeRateLimit("photo-download", subjectKey("ip", clientIp(request.headers)), {
      limit: 300,
      windowSeconds: 15 * 60,
    });
    const { token, photoId } = await params;
    if (!/^[0-9a-f]{24}$/i.test(photoId))
      throw new AppError("NOT_FOUND", "That photo is not available.");
    const access = await openGallery(token);
    const url = await guestDownloadUrl(access, photoId);
    return NextResponse.redirect(new URL(url, request.url), {
      status: 307,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return jsonError(err);
  }
}
