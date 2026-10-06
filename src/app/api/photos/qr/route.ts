import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authz";
import { jsonError } from "@/lib/http";
import { absoluteUrl } from "@/lib/app-url";
import { qrPng, qrSvg } from "@/lib/qr";
import { getGallerySettings } from "@/modules/wedding/service";

export const dynamic = "force-dynamic";

// GET /api/photos/qr?format=png|svg: the couple's photo-gallery QR, to save, share or print. Only
// a signed-in member of the wedding can get it, since it encodes the private gallery link.
export async function GET(request: Request) {
  try {
    const ctx = await requireMember();
    const format = new URL(request.url).searchParams.get("format") === "svg" ? "svg" : "png";
    const { token } = await getGallerySettings(ctx.weddingId);
    const link = absoluteUrl(`/g/${token}`);
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="wedding-photos-qr.${format}"`,
    };
    if (format === "svg")
      return new NextResponse(await qrSvg(link), {
        headers: { ...headers, "Content-Type": "image/svg+xml" },
      });
    return new NextResponse(new Uint8Array(await qrPng(link)), {
      headers: { ...headers, "Content-Type": "image/png" },
    });
  } catch (err) {
    return jsonError(err);
  }
}
