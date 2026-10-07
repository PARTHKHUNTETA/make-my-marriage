import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { qrPng } from "@/lib/qr";
import { getEntryTokenForMember } from "@/modules/guests/service";

export const dynamic = "force-dynamic";

// GET /api/guests/[id]/entry/[eventId]: a coming guest's entry QR as a PNG, for a team member who
// wants to show it at the gate, send it, or print it. `?download=1` saves it as a file. The code is
// the same one the guest sees on their own page. Members only, and only for this wedding's guests.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const ctx = await requireMember();
    const { id, eventId } = await params;
    const token = await getEntryTokenForMember(ctx.weddingId, id, eventId);
    if (!token)
      throw new AppError("NOT_FOUND", "There is no entry code for this guest and event yet.");
    const png = await qrPng(token, 600);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(download ? { "Content-Disposition": 'attachment; filename="entry-qr.png"' } : {}),
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
