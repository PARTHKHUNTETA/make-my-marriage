import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { guestSignSchema } from "@/modules/photos/schema";
import { guestRequestUploads, openGallery } from "@/modules/photos/gallery";

export const dynamic = "force-dynamic";

// POST /api/g/[token]/sign: a guest asks for somewhere to put their photos. Limited per device, by
// calls and by the number of files, so one phone cannot fill the couple's storage with junk.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ip = subjectKey("ip", clientIp(request.headers));
    await consumeRateLimit("photo-sign", ip, { limit: 60, windowSeconds: 15 * 60 });
    const { token } = await params;
    const access = await openGallery(token);
    const input = guestSignSchema.parse(await readJsonBody(request));
    await consumeRateLimit("photo-files", ip, {
      limit: 300,
      windowSeconds: 60 * 60,
      cost: input.files.length,
    });
    return jsonOk(await guestRequestUploads(access, input));
  } catch (err) {
    return jsonError(err);
  }
}
